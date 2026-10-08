/**
 * Response conventions shared with the dataimago-ai template
 * (apps/template/src/app/api/_lib): payload plus a `_meta` block (requestId,
 * elapsedMs, endpoint, provenance), and one redacted error body
 * `{ status: 'error', code, message, requestId }`. Internal detail never
 * crosses the client boundary.
 */
import { randomUUID } from 'node:crypto';

import { counterStore, hit } from './limits';
import { provenance, type Collection, type Provenance } from './library';

export type ApiErrorCode =
  | 'INVALID_PARAM'
  | 'MISSING_REQUIRED_PARAM'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR';

const STATUS: Record<ApiErrorCode, number> = {
  INVALID_PARAM: 400,
  MISSING_REQUIRED_PARAM: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UNAVAILABLE: 503,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface Ctx {
  requestId: string;
  startedAt: number;
  endpoint: string;
}

export interface ResponseMeta {
  requestId: string;
  elapsedMs: number;
  endpoint: string;
  provenance?: Provenance;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, mcp-protocol-version, mcp-session-id, accept',
};

export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export function meta(ctx: Ctx, collection?: Collection): ResponseMeta {
  return {
    requestId: ctx.requestId,
    elapsedMs: Date.now() - ctx.startedAt,
    endpoint: ctx.endpoint,
    ...(collection ? { provenance: provenance(collection) } : {}),
  };
}

export function ok(ctx: Ctx, data: unknown, collection?: Collection, init?: ResponseInit): Response {
  return Response.json(
    { status: 'ok', data, _meta: meta(ctx, collection) },
    { ...init, headers: { ...CORS, ...(init?.headers ?? {}) } },
  );
}

export function errorResponse(ctx: Ctx, code: ApiErrorCode, message: string): Response {
  return Response.json(
    { status: 'error', code, message, requestId: ctx.requestId },
    { status: STATUS[code], headers: { ...CORS, ...(code === 'RATE_LIMITED' ? { 'retry-after': '60' } : {}) } },
  );
}

export function clientIp(request: Request): string {
  // Vercel sets x-forwarded-for; the first address is the client.
  const fwd = request.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

/** Per-IP request budget for read endpoints (REST and MCP). */
export const READ_LIMIT_PER_MINUTE = 120;

export async function handle(
  request: Request,
  endpoint: string,
  fn: (ctx: Ctx) => Promise<Response>,
  opts: { rateLimit?: { bucket: string; perMinute: number } | false } = {},
): Promise<Response> {
  const ctx: Ctx = { requestId: randomUUID(), startedAt: Date.now(), endpoint };
  try {
    const limit = opts.rateLimit === undefined ? { bucket: 'read', perMinute: READ_LIMIT_PER_MINUTE } : opts.rateLimit;
    if (limit && !(await hit(counterStore(), limit.bucket, clientIp(request), limit.perMinute, 60))) {
      return errorResponse(ctx, 'RATE_LIMITED', 'Too many requests; try again in a minute.');
    }
    return await fn(ctx);
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(ctx, err.code, err.message);
    // Logged by request id and error class only.
    console.error(`[${ctx.requestId}] ${endpoint}: ${(err as Error)?.name ?? 'Error'}`);
    return errorResponse(ctx, 'INTERNAL_ERROR', 'Internal error.');
  }
}

export function intParam(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ApiError('INVALID_PARAM', `must be an integer from ${min} to ${max}`);
  }
  return n;
}
