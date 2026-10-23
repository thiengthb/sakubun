import { describe, expect, it } from 'vitest';
import { ratingForAnswer } from '@/lib/domain/quick-review';

describe('ratingForAnswer', () => {
  it('a flip card maps the two buttons to Again and Good', () => {
    expect(ratingForAnswer({ mode: 'flip', remembered: false })).toBe(1);
    expect(ratingForAnswer({ mode: 'flip', remembered: true })).toBe(3);
  });

  it('a cloze maps a wrong choice to Again and the right one to Good', () => {
    expect(ratingForAnswer({ mode: 'cloze', correct: false })).toBe(1);
    expect(ratingForAnswer({ mode: 'cloze', correct: true })).toBe(3);
  });
});
