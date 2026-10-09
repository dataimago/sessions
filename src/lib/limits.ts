/**
 * Counters for rate limits, the daily Ask spend cap, and question counts.
 *
 * Production uses Upstash Redis (Vercel Marketplace; `KV_REST_API_URL` /
 * `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`),
 * so the cap holds across every function instance. Without Redis, counters
 * live in this instance's memory: fine for `next dev`, and for best-effort
 * per-IP limits, but **Ask fails closed in production without Redis** — a
 * per-instance spend cap is not a cap.
 *
 * Only numbers are stored. Question text is never written anywhere.
 */
import { Redis } from '@upstash/redis';

export interface CounterStore {
  kind: 'redis' | 'memory';
  /** Add `by` to `key` (created with `ttlSec` expiry) and return the new value. */
  incrBy(key: string, by: number, ttlSec: number): Promise<number>;
  get(key: string): Promise<number>;
}

export function memoryStore(now: () => number = Date.now): CounterStore {
  const values = new Map<string, { value: number; expiresAt: number }>();
  const live = (key: string) => {
    const v = values.get(key);
    if (v && v.expiresAt <= now()) {
      values.delete(key);
      return undefined;
    }
    return v;
  };
  return {
    kind: 'memory',
    async incrBy(key, by, ttlSec) {
      const v = live(key) ?? { value: 0, expiresAt: now() + ttlSec * 1000 };
      v.value += by;
      values.set(key, v);
      return v.value;
    },
    async get(key) {
      return live(key)?.value ?? 0;
    },
  };
}

function redisStore(redis: Redis): CounterStore {
  return {
    kind: 'redis',
    async incrBy(key, by, ttlSec) {
      const [value] = await redis.multi().incrby(key, by).expire(key, ttlSec, 'NX').exec<[number, number]>();
      return value;
    },
    async get(key) {
      return Number((await redis.get<number>(key)) ?? 0);
    },
  };
}

function redisFromEnv(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

let store: CounterStore | null = null;

export function counterStore(): CounterStore {
  if (!store) {
    const redis = redisFromEnv();
    store = redis ? redisStore(redis) : memoryStore();
  }
  return store;
}

/** For tests. */
export function setCounterStore(s: CounterStore | null): void {
  store = s;
}

export function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

export function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Fixed-window limit. Returns whether this call is allowed. */
export async function hit(
  s: CounterStore,
  bucket: string,
  key: string,
  limit: number,
  windowSec: number,
  now = Date.now(),
): Promise<boolean> {
  const window = Math.floor(now / 1000 / windowSec);
  const count = await s.incrBy(`rl:${bucket}:${window}:${key}`, 1, windowSec + 5);
  return count <= limit;
}

/**
 * `hit` for the read API and MCP, which cost nothing to serve: when the
 * counter store fails (Redis down or out of quota), allow the request rather
 * than take the library offline. Ask never uses this; its limits and spend cap
 * fail closed.
 */
export async function hitOrAllow(
  s: CounterStore,
  bucket: string,
  key: string,
  limit: number,
  windowSec: number,
  now = Date.now(),
): Promise<boolean> {
  try {
    return await hit(s, bucket, key, limit, windowSec, now);
  } catch (err) {
    console.error(`rate limit ${bucket}: counter store unavailable (${(err as Error)?.name ?? 'Error'}); allowing`);
    return true;
  }
}

export const MICRO = 1_000_000;

export function dailyCapUsd(): number {
  const raw = Number(process.env.SESSIONS_ASK_DAILY_CAP_USD);
  return Number.isFinite(raw) && raw >= 0 ? raw : 3;
}

/**
 * Reserve `estimateUsd` against today's cap before calling the model. Returns
 * a settle function to call with the actual cost, or null when the cap would
 * be exceeded (the reservation is released). Reserving first means concurrent
 * questions cannot jointly overshoot the cap.
 */
export async function reserveSpend(
  s: CounterStore,
  estimateUsd: number,
  capUsd: number,
  day = utcDay(),
): Promise<((actualUsd: number) => Promise<void>) | null> {
  const key = `ask:spend:${day}`;
  const reserved = Math.ceil(estimateUsd * MICRO);
  const total = await s.incrBy(key, reserved, 2 * 86_400);
  if (total > capUsd * MICRO) {
    await s.incrBy(key, -reserved, 2 * 86_400);
    return null;
  }
  return async (actualUsd: number) => {
    const delta = Math.ceil(actualUsd * MICRO) - reserved;
    if (delta !== 0) await s.incrBy(key, delta, 2 * 86_400);
  };
}

export async function spentTodayUsd(s: CounterStore, day = utcDay()): Promise<number> {
  return (await s.get(`ask:spend:${day}`)) / MICRO;
}

export type AskOutcome = 'answered' | 'abstained' | 'refused_cap' | 'refused_rate' | 'failed';

/** Count, never content. */
export async function countAsk(s: CounterStore, outcome: AskOutcome, day = utcDay()): Promise<void> {
  await s.incrBy(`ask:count:${day}:${outcome}`, 1, 400 * 86_400);
}
