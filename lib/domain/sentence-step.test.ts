import { describe, expect, it } from 'vitest';
import { sentenceStep, STEP_CAP, type PastReview } from '@/lib/domain/sentence-step';

const r = (...ratings: number[]): PastReview[] =>
  ratings.map((rating) => ({ rating, hinted: false }));

describe('sentenceStep', () => {
  it('starts a new item at step 1', () => {
    expect(sentenceStep([], 'N3')).toEqual({ step: 1, pastCap: 0 });
  });

  it('goes up on Easy, and on Good twice in a row', () => {
    expect(sentenceStep(r(4), 'N3').step).toBe(2);
    expect(sentenceStep(r(3), 'N3').step).toBe(1);
    expect(sentenceStep(r(3, 3), 'N3').step).toBe(2);
    expect(sentenceStep(r(3, 3, 3), 'N3').step).toBe(2);
    expect(sentenceStep(r(3, 3, 3, 3), 'N3').step).toBe(3);
    expect(sentenceStep(r(4, 4, 4, 4, 4), 'N1').step).toBe(5);
  });

  it('Hard keeps the step and starts the Good run again', () => {
    expect(sentenceStep(r(3, 2, 3), 'N3').step).toBe(1);
    expect(sentenceStep(r(4, 2), 'N3').step).toBe(2);
  });

  it('Again goes down one step, never below 1', () => {
    expect(sentenceStep(r(4, 4, 1), 'N3').step).toBe(2);
    expect(sentenceStep(r(1, 1), 'N3').step).toBe(1);
    expect(sentenceStep(r(3, 1, 3), 'N3').step).toBe(1);
  });

  it('a Good with a hint does not count toward a rise', () => {
    const reviews = [
      { rating: 3, hinted: false },
      { rating: 3, hinted: true },
    ];
    expect(sentenceStep(reviews, 'N3').step).toBe(1);
    expect(sentenceStep([...reviews, { rating: 3, hinted: false }], 'N3').step).toBe(2);
  });

  it('stops at the cap of the item’s level and counts the rises past it', () => {
    expect(STEP_CAP).toEqual({ N5: 3, N4: 4, N3: 5, N2: 5, N1: 5 });
    expect(sentenceStep(r(4, 4), 'N5')).toEqual({ step: 3, pastCap: 0 });
    expect(sentenceStep(r(4, 4, 4), 'N5')).toEqual({ step: 3, pastCap: 1 });
    expect(sentenceStep(r(4, 4, 4, 3, 3), 'N5')).toEqual({ step: 3, pastCap: 2 });
    expect(sentenceStep(r(4, 4, 4, 4, 4), 'N4')).toEqual({ step: 4, pastCap: 2 });
  });

  it('an Again clears the rises past the cap, so the words around come back down', () => {
    expect(sentenceStep(r(4, 4, 4, 4, 1), 'N5')).toEqual({ step: 2, pastCap: 0 });
  });

  it('follows the plan’s ~は example', () => {
    // new 1 → Good, Good 2 → Easy 3 → Easy: words around up → Again 2.
    const seq = [3, 3, 4, 4, 1];
    const steps = seq.map((_, i) => sentenceStep(r(...seq.slice(0, i + 1)), 'N5'));
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3, 3, 2]);
    expect(steps[3].pastCap).toBe(1);
  });
});
