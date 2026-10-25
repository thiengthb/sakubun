import { describe, expect, it } from 'vitest';
import { isRemembered, ratingForAnswer, RATINGS } from '@/lib/domain/quick-review';

describe('ratingForAnswer', () => {
  it('a flip card passes its button through as the FSRS rating', () => {
    for (const rating of RATINGS) expect(ratingForAnswer({ mode: 'flip', rating })).toBe(rating);
  });

  it('a cloze maps a wrong choice to Again and the right one to Good', () => {
    expect(ratingForAnswer({ mode: 'cloze', correct: false })).toBe(1);
    expect(ratingForAnswer({ mode: 'cloze', correct: true })).toBe(3);
  });
});

describe('isRemembered', () => {
  it('counts Good and Easy as remembered, Again and Hard as not, like true retention', () => {
    expect(RATINGS.map(isRemembered)).toEqual([false, false, true, true]);
  });
});
