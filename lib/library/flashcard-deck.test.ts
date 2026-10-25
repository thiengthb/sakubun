import { describe, expect, it } from 'vitest';
import { FRESH_DECK, resumeDeck, shuffleIds } from './flashcard-deck';

describe('shuffleIds', () => {
  it('keeps every id once and leaves the input alone', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const out = shuffleIds(ids, () => 0);
    expect([...out].sort()).toEqual(ids);
    expect(out).not.toEqual(ids);
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('resumeDeck', () => {
  it('starts a fresh deck in the group order at the first card', () => {
    expect(resumeDeck(['a', 'b'], null)).toEqual({ order: ['a', 'b'], index: 0 });
    expect(resumeDeck(['a', 'b'], FRESH_DECK)).toEqual({ order: ['a', 'b'], index: 0 });
  });

  it('resumes a saved shuffle and position', () => {
    expect(resumeDeck(['a', 'b', 'c'], { shuffled: ['c', 'a', 'b'], index: 2 })).toEqual({
      order: ['c', 'a', 'b'],
      index: 2,
    });
  });

  it('drops removed items from a saved shuffle and appends added ones', () => {
    expect(resumeDeck(['a', 'c', 'd'], { shuffled: ['c', 'b', 'a'], index: 1 })).toEqual({
      order: ['c', 'a', 'd'],
      index: 1,
    });
  });

  it('keeps the position on a real card, or at the end', () => {
    expect(resumeDeck(['a', 'b'], { shuffled: null, index: 9 }).index).toBe(2);
    expect(resumeDeck(['a', 'b'], { shuffled: null, index: -3 }).index).toBe(0);
    expect(resumeDeck(['a', 'b'], { shuffled: null, index: 1.5 }).index).toBe(0);
    expect(resumeDeck([], { shuffled: ['x'], index: 1 })).toEqual({ order: [], index: 0 });
  });
});
