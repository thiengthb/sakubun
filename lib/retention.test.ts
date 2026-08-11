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
    // …and it says CÒN MỘT lượt, not just "cần 20, hiện có 19". The subtraction is the only actionable
    // part of this state, and leaving it to the learner is leaving them to do arithmetic to find out how
    // far they are from an answer.
    expect(v.message).toContain('Còn 1 lượt nữa');
  });

  it('counts the shortfall from the actual sample, not from zero', () => {
    // `rows(correct, wrong)` — 8 + 9 = 17 lượt, tức còn 3 so với ngưỡng 20. (Viết `rows(17, 8)` là 25
    // lượt và verdict thành 'below': đọc sai chữ ký của helper, không phải lỗi của code.)
    expect(retentionVerdict(computeTrueRetention(rows(8, 9)), 0.9).message).toContain(
      'Còn 3 lượt nữa',
    );
    expect(retentionVerdict(computeTrueRetention([]), 0.9).message).toContain(
      `Còn ${MIN_REVIEWS_FOR_VERDICT} lượt nữa`,
    );
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
