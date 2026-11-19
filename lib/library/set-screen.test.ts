import { describe, expect, it } from 'vitest';
import { levelSets, type SetEntry, type SetItem } from './level-sets';
import {
  firstOpenWord,
  parseSetNumber,
  setHref,
  setMeta,
  setNeighbours,
  wordLink,
} from './set-screen';

const NOW = new Date('2026-11-18T12:00:00Z');
const PAST = new Date('2026-11-17T12:00:00Z');
const FUTURE = new Date('2026-11-25T12:00:00Z');
const N5_VOCAB = { level: 'N5', kind: 'vocab' } as const;

const entries = (n: number): SetEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `e-w${i + 1}`,
    expression: `w${i + 1}`,
    reading: null,
    hanviet: null,
    meaningVi: null,
  }));
const item = (expression: string, over: Partial<SetItem> = {}): SetItem => ({
  id: `id-${expression}`,
  expression,
  suspended: false,
  state: 2,
  due: FUTURE,
  lapses: 0,
  ...over,
});

describe('set links', () => {
  it('opens a set under its level', () => {
    expect(setHref(N5_VOCAB, 3)).toBe('/resources/level/N5/vocab/3');
  });

  it('reads only a set the level has', () => {
    expect(parseSetNumber('2', 3)).toBe(2);
    expect(parseSetNumber('3', 3)).toBe(3);
    for (const raw of ['0', '4', '02', '1.5', '-1', 'abc', ''])
      expect(parseSetNumber(raw, 3)).toBeNull();
  });

  it('has no set before the first or after the last', () => {
    expect(setNeighbours(1, 3)).toEqual({ prev: null, next: 2 });
    expect(setNeighbours(2, 3)).toEqual({ prev: 1, next: 3 });
    expect(setNeighbours(3, 3)).toEqual({ prev: 2, next: null });
    expect(setNeighbours(1, 1)).toEqual({ prev: null, next: null });
  });
});

describe('the set screen', () => {
  it('counts the set and names its states', () => {
    const { sets } = levelSets(entries(3), [item('w1'), item('w2', { due: PAST })], NOW);
    expect(setMeta(sets[0]!, N5_VOCAB)).toBe('3 từ · 1 thuộc · 1 đến hạn · 1 chưa có');
    expect(setMeta(sets[0]!, { level: 'N5', kind: 'grammar' })).toMatch(/^3 mẫu/);
  });

  it('opens the first due word, then the first never studied, else the first', () => {
    const due = levelSets(
      entries(4),
      [item('w1'), item('w2', { state: 0 }), item('w3', { due: PAST })],
      NOW,
    );
    expect(firstOpenWord(due.sets[0]!.words)).toBe(2);
    const fresh = levelSets(entries(3), [item('w1'), item('w2', { state: 0 })], NOW);
    expect(firstOpenWord(fresh.sets[0]!.words)).toBe(1);
    const learnt = levelSets(entries(2), [item('w1'), item('w2')], NOW);
    expect(firstOpenWord(learnt.sets[0]!.words)).toBe(0);
  });

  it("links a word to the learner's item, or to its entry in Kho chung when it is not taken", () => {
    const { sets } = levelSets(entries(2), [item('w1')], NOW);
    const [owned, missing] = sets[0]!.words;
    expect(wordLink(owned!)).toEqual({ label: 'Mở mục', href: '/resources/id-w1' });
    expect(wordLink(missing!)).toEqual({ label: 'Xem ở Kho chung', href: '/library/item/e-w2' });
  });
});
