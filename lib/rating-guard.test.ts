import { describe, expect, it } from 'vitest';
import { earnedRating, easyCeilingFor, EASY_MAX_SECONDS_DEFAULT } from '@/lib/rating-guard';

const QUIZ = easyCeilingFor('QUIZ');
const fast = { elapsedSec: 12, assists: 0, exerciseType: 'QUIZ' };

describe('Easy has to be earned', () => {
  it('lets a fast, unassisted Easy through', () => {
    expect(earnedRating(4, fast)).toEqual({ rating: 4 });
  });

  it('downgrades Easy to Good when the answer took too long', () => {
    const v = earnedRating(4, { elapsedSec: QUIZ + 1, assists: 0, exerciseType: 'QUIZ' });
    expect(v.rating).toBe(3);
    expect(v.downgradedFrom).toBe(4);
    expect(v.reason).toMatch(/Good/);
  });

  it('downgrades Easy to Good when the learner needed help', () => {
    const v = earnedRating(4, { elapsedSec: 5, assists: 1, exerciseType: 'QUIZ' });
    expect(v.rating).toBe(3);
    expect(v.reason).toMatch(/gợi ý/);
  });

  it('reports assists before time when both fail, so the message names the real reason', () => {
    expect(earnedRating(4, { elapsedSec: 999, assists: 2, exerciseType: 'QUIZ' }).reason).toMatch(/2 gợi ý/);
  });
});

describe('the guard only ever moves DOWN, and only Easy', () => {
  it('never touches Again / Hard / Good, however slow', () => {
    for (const claimed of [1, 2, 3] as const) {
      expect(earnedRating(claimed, { elapsedSec: 9999, assists: 5, exerciseType: 'QUIZ' })).toEqual({
        rating: claimed,
      });
    }
  });

  it('never promotes a fast answer', () => {
    expect(earnedRating(3, fast)).toEqual({ rating: 3 });
    expect(earnedRating(1, fast)).toEqual({ rating: 1 });
  });
});

describe('missing evidence does not withhold a legitimate Easy', () => {
  it('allows Easy when elapsed time is unknown', () => {
    expect(earnedRating(4, { elapsedSec: null, assists: 0, exerciseType: 'QUIZ' })).toEqual({ rating: 4 });
  });

  it('treats a nonsense assist count as zero rather than throwing on the FSRS path', () => {
    expect(earnedRating(4, { elapsedSec: 5, assists: Number.NaN, exerciseType: 'QUIZ' }).rating).toBe(4);
    expect(earnedRating(4, { elapsedSec: 5, assists: -3, exerciseType: 'QUIZ' }).rating).toBe(4);
  });

  it('is inclusive at the boundary', () => {
    expect(earnedRating(4, { elapsedSec: QUIZ, assists: 0, exerciseType: 'QUIZ' }).rating).toBe(4);
  });
});

describe('the ceiling is per exercise type, because one number is wrong in both directions', () => {
  it('holds a quiz pick to a far tighter clock than a translation', () => {
    expect(easyCeilingFor('QUIZ')).toBeLessThan(easyCeilingFor('TRANSLATION'));
    const slowForQuiz = { elapsedSec: 40, assists: 0 };
    expect(earnedRating(4, { ...slowForQuiz, exerciseType: 'QUIZ' }).rating).toBe(3);
    expect(earnedRating(4, { ...slowForQuiz, exerciseType: 'TRANSLATION' }).rating).toBe(4);
  });

  it('falls back to a LENIENT default for a loop with no measured history', () => {
    expect(easyCeilingFor('TEACH_BACK')).toBe(EASY_MAX_SECONDS_DEFAULT);
    expect(easyCeilingFor(undefined)).toBe(EASY_MAX_SECONDS_DEFAULT);
    expect(earnedRating(4, { elapsedSec: 90, assists: 0, exerciseType: 'TEACH_BACK' }).rating).toBe(4);
  });

  it('names the ceiling in the reason, so the learner can see the rule', () => {
    const v = earnedRating(4, { elapsedSec: 60, assists: 0, exerciseType: 'QUIZ' });
    expect(v.reason).toContain(String(easyCeilingFor('QUIZ')));
    expect(v.reason).toContain('60s');
  });
});
