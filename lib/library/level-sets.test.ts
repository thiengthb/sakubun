import { describe, expect, it } from 'vitest';
import { levelSets, nextStep, wordState, type SetEntry, type SetItem } from './level-sets';

const NOW = new Date('2026-11-18T12:00:00Z');
const PAST = new Date('2026-11-17T12:00:00Z');
const FUTURE = new Date('2026-11-25T12:00:00Z');

const entry = (expression: string): SetEntry => ({
  id: `e-${expression}`,
  expression,
  reading: null,
  hanviet: null,
  meaningVi: `nghĩa ${expression}`,
});

const item = (expression: string, over: Partial<SetItem> = {}): SetItem => ({
  id: `id-${expression}`,
  expression,
  suspended: false,
  state: 2,
  due: FUTURE,
  lapses: 0,
  ...over,
});

const words = (n: number) => Array.from({ length: n }, (_, i) => entry(`w${i + 1}`));

describe('wordState', () => {
  it('names each state', () => {
    expect(wordState(null, NOW)).toBe('none');
    expect(wordState(item('a', { state: 0 }), NOW)).toBe('new');
    expect(wordState(item('a', { state: null, due: null }), NOW)).toBe('new');
    expect(wordState(item('a', { state: 1 }), NOW)).toBe('learning');
    expect(wordState(item('a', { state: 3 }), NOW)).toBe('learning');
    expect(wordState(item('a', { state: 2 }), NOW)).toBe('mastered');
    expect(wordState(item('a', { state: 2, due: PAST }), NOW)).toBe('due');
    expect(wordState(item('a', { state: 1, due: NOW }), NOW)).toBe('due');
  });

  it('keeps a suspended item paused, even when due', () => {
    expect(wordState(item('a', { suspended: true, due: PAST }), NOW)).toBe('paused');
  });
});

describe('levelSets', () => {
  it('cuts the level into sets of 20 in the group order, the last one shorter', () => {
    const result = levelSets(words(45), [], NOW);
    expect(result.sets.map((s) => s.words.length)).toEqual([20, 20, 5]);
    expect(result.sets.map((s) => s.number)).toEqual([1, 2, 3]);
    expect(result.sets[1].words[0].entry.expression).toBe('w21');
    expect(result.counts.none).toBe(45);
  });

  it('counts a word listed twice once, where it first appears', () => {
    const result = levelSets([entry('a'), entry('b'), entry('a')], [], NOW);
    expect(result.sets[0].words.map((w) => w.entry.expression)).toEqual(['a', 'b']);
  });

  it('counts states per set and for the level, mastered as on the level board', () => {
    const result = levelSets(
      words(22),
      [
        item('w1'),
        item('w2', { due: PAST }),
        item('w3', { state: 1 }),
        item('w4', { state: 0 }),
        item('w5', { suspended: true }),
        item('w21', { state: 0 }),
      ],
      NOW,
    );
    expect(result.sets[0].counts).toEqual({
      mastered: 1,
      due: 1,
      learning: 1,
      new: 1,
      paused: 1,
      none: 15,
    });
    expect(result.sets[1].counts.new).toBe(1);
    expect(result.counts.new).toBe(2);
    // w1 and w2 are both in the Review state; w2 is also due.
    expect(result.mastered).toBe(2);
  });

  it('gives no sets for an empty level', () => {
    const result = levelSets([], [], NOW);
    expect(result.sets).toEqual([]);
    expect(result.next).toBeNull();
    expect(result.forgotten).toEqual([]);
  });

  it('lists the most forgotten words, most lapses first, skipping suspended ones', () => {
    const result = levelSets(
      words(5),
      [
        item('w1', { lapses: 1 }),
        item('w2', { lapses: 4 }),
        item('w3', { lapses: 1 }),
        item('w4', { lapses: 9, suspended: true }),
        item('w5'),
      ],
      NOW,
    );
    expect(result.forgotten.map((w) => w.entry.expression)).toEqual(['w2', 'w1', 'w3']);
  });
});

describe('nextStep', () => {
  it('opens the first set with words never studied', () => {
    const owned = words(60).map((e, i) => item(e.expression, { state: i >= 25 ? 0 : 2 }));
    const { sets } = levelSets(words(60), owned, NOW);
    expect(nextStep(sets)).toEqual({ set: 2, kind: 'study', count: 15 });
  });

  it('then the first set with words still to take', () => {
    const owned = words(30).map((e) => item(e.expression));
    const { sets } = levelSets(words(45), owned, NOW);
    expect(nextStep(sets)).toEqual({ set: 2, kind: 'take', count: 10 });
  });

  it('has nothing left when every word is taken and studied', () => {
    const owned = words(20).map((e) => item(e.expression));
    expect(nextStep(levelSets(words(20), owned, NOW).sets)).toBeNull();
  });
});
