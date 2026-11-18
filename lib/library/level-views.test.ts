import { describe, expect, it } from 'vitest';
import { levelSets, type SetEntry } from './level-sets';
import { activeFilter, levelViewHref, levelWords, parseLevelView } from './level-views';

const NOW = new Date('2026-11-18T12:00:00Z');
const N4_VOCAB = { level: 'N4', kind: 'vocab' } as const;

const entries = (n: number): SetEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    expression: `w${i + 1}`,
    reading: null,
    hanviet: null,
    meaningVi: null,
  }));

describe('level views', () => {
  it('opens the sets unless the address names another view', () => {
    expect(parseLevelView('map')).toBe('map');
    for (const raw of [undefined, '', 'sets', 'MAP', 'grid', ['map']])
      expect(parseLevelView(raw)).toBe('sets');
  });

  it('keeps the sets at the plain address', () => {
    expect(levelViewHref(N4_VOCAB, 'sets')).toBe('/resources/level/N4/vocab');
    expect(levelViewHref(N4_VOCAB, 'map')).toBe('/resources/level/N4/vocab?view=map');
  });

  it('lists every word of the level in order, each with its set', () => {
    const words = levelWords(
      levelSets(
        entries(23),
        [
          {
            id: 'i21',
            expression: 'w21',
            suspended: false,
            state: 2,
            due: NOW,
            lapses: 2,
          },
        ],
        NOW,
      ),
      N4_VOCAB,
    );
    expect(words).toHaveLength(23);
    expect(words[0]!.set).toEqual({ number: 1, href: '/resources/level/N4/vocab/1' });
    expect(words[20]).toMatchObject({
      expression: 'w21',
      state: 'due',
      lapses: 2,
      set: { number: 2 },
      link: { href: '/resources/i21' },
    });
  });

  it('drops a filter whose state has no word left', () => {
    const words = [{ state: 'due' as const }, { state: 'new' as const }];
    expect(activeFilter('due', words)).toBe('due');
    expect(activeFilter('all', words)).toBe('all');
    expect(activeFilter('mastered', words)).toBe('all');
    expect(activeFilter('due', [])).toBe('all');
  });
});
