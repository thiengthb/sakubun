import { describe, expect, it } from 'vitest';
import { computeStreak } from '@/lib/streak';

describe('computeStreak', () => {
  it('empty history → zero', () => {
    expect(computeStreak([], '2026-07-06')).toEqual({ current: 0, longest: 0 });
  });

  it('consecutive days count up and today-not-yet-studied keeps the chain', () => {
    const days = ['2026-07-03', '2026-07-04', '2026-07-05'];
    expect(computeStreak(days, '2026-07-05')).toEqual({ current: 3, longest: 3 });
    expect(computeStreak(days, '2026-07-06')).toEqual({ current: 3, longest: 3 });
  });

  it('one missed day is forgiven (loss-soft), two are not', () => {
    expect(computeStreak(['2026-07-01', '2026-07-03'], '2026-07-03').current).toBe(2);
    expect(computeStreak(['2026-07-01', '2026-07-04'], '2026-07-04').current).toBe(1);
    expect(computeStreak(['2026-07-01', '2026-07-02'], '2026-07-06').current).toBe(0);
  });

  it('longest survives a broken current streak', () => {
    const days = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-07-05'];
    const s = computeStreak(days, '2026-07-06');
    expect(s.longest).toBe(4);
    expect(s.current).toBe(1);
  });
});
