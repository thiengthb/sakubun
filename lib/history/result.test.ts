import { describe, expect, it } from 'vitest';
import { historyResult } from './result';

const row = (status: string, score: number | null, rating: number | null = null) => ({
  status,
  score,
  rating,
});

describe('historyResult', () => {
  it('a scored turn shows the bare number, the /100 form for the hover', () => {
    expect(historyResult(row('GRADED', 62))).toEqual({ text: '62', full: '62/100', tone: 'warn' });
  });

  it('zero is still a number, not a missing score', () => {
    expect(historyResult(row('GRADED', 0))).toEqual({ text: '0', full: '0/100', tone: 'alert' });
  });

  it('colours scores in four bands', () => {
    expect([49, 50, 70, 90, 100].map((s) => historyResult(row('GRADED', s))?.tone)).toEqual([
      'alert',
      'warn',
      'ok',
      'info',
      'info',
    ]);
  });

  it('a v2 turn shows its grade, coloured on the same scale', () => {
    expect(historyResult(row('GRADED', null, 3))).toEqual({
      text: 'Good',
      full: '3/4',
      tone: 'ok',
    });
    expect(historyResult(row('GRADED', null, 1))?.tone).toBe('alert');
  });

  it('a graded turn with no score says so instead of returning null', () => {
    expect(historyResult(row('GRADED', null))).toEqual({
      text: 'Chưa có điểm',
      full: 'Chưa có điểm',
      tone: 'muted',
    });
  });

  it('skipped is a state, not a score', () => {
    expect(historyResult(row('SKIPPED', 70))).toEqual({
      text: 'Bỏ qua',
      full: 'Bỏ qua',
      tone: 'muted',
    });
  });

  it('a waiting turn has no result', () => {
    expect(historyResult(row('PENDING', null))).toBeNull();
  });
});
