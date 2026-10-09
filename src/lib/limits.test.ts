import { describe, expect, it } from 'vitest';

import { type CounterStore, MICRO, hit, hitOrAllow, memoryStore, reserveSpend, spentTodayUsd } from './limits';

describe('limits', () => {
  it('allows up to the limit within a window, then refuses, then resets', async () => {
    let t = 0;
    const s = memoryStore(() => t);
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect(await hit(s, 'b', 'ip', 3, 60, now)).toBe(true);
    expect(await hit(s, 'b', 'ip', 3, 60, now)).toBe(false);
    expect(await hit(s, 'b', 'other', 3, 60, now)).toBe(true);
    t = 120_000;
    expect(await hit(s, 'b', 'ip', 3, 60, now + 61_000)).toBe(true);
  });

  it('lets reads through when the counter store fails, but not hit itself', async () => {
    const broken: CounterStore = {
      kind: 'redis',
      incrBy: () => Promise.reject(new Error('quota exceeded')),
      get: () => Promise.reject(new Error('quota exceeded')),
    };
    const quiet = console.error;
    console.error = () => {};
    try {
      expect(await hitOrAllow(broken, 'read', 'ip', 1, 60)).toBe(true);
    } finally {
      console.error = quiet;
    }
    await expect(hit(broken, 'ask-min', 'ip', 1, 60)).rejects.toThrow();
    await expect(reserveSpend(broken, 0.05, 3)).rejects.toThrow();
  });

  it('reserves against the daily cap and settles to the actual cost', async () => {
    const s = memoryStore();
    const day = '2026-10-08';
    const settle = await reserveSpend(s, 0.05, 3, day);
    expect(settle).not.toBeNull();
    expect(await spentTodayUsd(s, day)).toBeCloseTo(0.05);
    await settle?.(0.02);
    expect(await spentTodayUsd(s, day)).toBeCloseTo(0.02);
  });

  it('refuses a reservation that would pass the cap and releases it', async () => {
    const s = memoryStore();
    const day = '2026-10-08';
    await s.incrBy(`ask:spend:${day}`, Math.round(2.97 * MICRO), 3600);
    expect(await reserveSpend(s, 0.05, 3, day)).toBeNull();
    expect(await spentTodayUsd(s, day)).toBeCloseTo(2.97);
    expect(await reserveSpend(s, 0.02, 3, day)).not.toBeNull();
  });
});
