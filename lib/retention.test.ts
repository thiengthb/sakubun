import { describe, expect, it } from 'vitest';
import { MIN_REVIEWS_FOR_VERDICT, computeTrueRetention, retentionVerdict } from '@/lib/retention';

const rows = (correct: number, wrong: number) => [
  ...Array.from({ length: correct }, () => ({ rating: 4 })),
  ...Array.from({ length: wrong }, () => ({ rating: 1 })),
];

describe('computeTrueRetention', () => {
  it('returns null rate with no qualifying reviews', () => {
    expect(computeTrueRetention([])).toEqual({ reviews: 0, correct: 0, rate: null });
  });

  it('counts Good and Easy as remembered, Again and Hard as not', () => {
    const r = computeTrueRetention([{ rating: 1 }, { rating: 2 }, { rating: 3 }, { rating: 4 }]);
    expect(r).toEqual({ reviews: 4, correct: 2, rate: 0.5 });
  });

  it('matches the live library snapshot (36 of 49 = 73%)', () => {
    // Guards the definition itself, not just the arithmetic: if someone later folds learning-step
    // reviews in, this number jumps and the test says so.
    const r = computeTrueRetention(rows(36, 13));
    expect(r.reviews).toBe(49);
    expect(Math.round((r.rate ?? 0) * 100)).toBe(73);
  });
});

describe('retentionVerdict', () => {
  it('refuses a verdict below the evidence threshold', () => {
    const v = retentionVerdict(computeTrueRetention(rows(10, 5)), 0.9);
    expect(v.kind).toBe('insufficient');
    expect(v.gapPts).toBeNull();
    expect(v.message).toContain(String(MIN_REVIEWS_FOR_VERDICT));
  });

  it('still refuses when the sample is one short of the threshold', () => {
    const v = retentionVerdict(computeTrueRetention(rows(MIN_REVIEWS_FOR_VERDICT - 1, 0)), 0.9);
    expect(v.kind).toBe('insufficient');
  });

  it('reports below-target for the real 73% against a 90% goal', () => {
    const v = retentionVerdict(computeTrueRetention(rows(36, 13)), 0.9);
    expect(v.kind).toBe('below');
    expect(v.gapPts).toBe(-17);
  });

  it('treats a small shortfall inside the band as on-target', () => {
    // 87 of 100 = 87%, 3 points under a 90% goal.
    const v = retentionVerdict(computeTrueRetention(rows(87, 13)), 0.9);
    expect(v.kind).toBe('on-target');
    expect(v.gapPts).toBe(-3);
  });

  it('suggests loosening the schedule when comfortably above target', () => {
    const v = retentionVerdict(computeTrueRetention(rows(98, 2)), 0.9);
    expect(v.kind).toBe('above');
    expect(v.gapPts).toBe(8);
  });

  it('reads the target from settings rather than assuming 0.9', () => {
    // Same 73% measurement, but a learner who asked for 70% is ON target, not failing.
    const v = retentionVerdict(computeTrueRetention(rows(36, 13)), 0.7);
    expect(v.kind).toBe('on-target');
  });
});
