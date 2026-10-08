import { describe, expect, it } from 'vitest';

import { MICRO, hit, memoryStore, reserveSpend, spentTodayUsd } from './limits';

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
