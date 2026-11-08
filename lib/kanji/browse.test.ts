import { describe, expect, it } from 'vitest';
import type { KanjiEntry } from '@/lib/kanji/catalog';
import { filterKanji, isKanjiLevelFilter } from '@/lib/kanji/browse';

const entry = (
  kanji: string,
  hanviet: string,
  meaningVi: string,
  level: KanjiEntry['level'],
  extra: Partial<KanjiEntry> = {},
): KanjiEntry => ({
  kanji,
  hanviet,
  meaningVi,
  level,
  strokes: 10,
  freq: null,
  on: [],
  kun: [],
  radical: { number: 1, radical: '一', nameVi: 'nhất' },
  parts: [],
  phon: null,
  ...extra,
});

const ALL = [
  entry('経', 'KINH', 'đi qua; kinh tế', 'N3', { on: ['ケイ', 'キョウ'], kun: ['へ.る'] }),
  entry('敬', 'KÍNH', 'kính trọng', 'N2'),
  entry('行', 'HÀNH', 'đi; làm', 'N5', { kun: ['い.く', 'おこな.う'] }),
  entry('済', 'TẾ', 'xong; cứu giúp', 'N3'),
  entry('璽', 'TỶ', 'ấn của vua', null),
];
const ids = (list: KanjiEntry[]) => list.map((e) => e.kanji);

describe('filterKanji', () => {
  it('keeps one level, every level, or the kanji outside JLPT, in catalog order', () => {
    expect(ids(filterKanji(ALL, { level: 'N3', query: '' }))).toEqual(['経', '済']);
    expect(ids(filterKanji(ALL, { level: 'all', query: ' ' }))).toEqual(ids(ALL));
    expect(ids(filterKanji(ALL, { level: 'none', query: '' }))).toEqual(['璽']);
  });

  it('finds each kanji typed, inside a word too', () => {
    expect(ids(filterKanji(ALL, { level: 'all', query: '経済' }))).toEqual(['経', '済']);
    expect(ids(filterKanji(ALL, { level: 'N5', query: '経済' }))).toEqual([]);
  });

  it('matches Hán Việt and meaning with any tone when typed without, only that tone when typed with', () => {
    expect(ids(filterKanji(ALL, { level: 'all', query: 'kinh' }))).toEqual(['経', '敬']);
    expect(ids(filterKanji(ALL, { level: 'all', query: 'KÍNH' }))).toEqual(['敬']);
    expect(ids(filterKanji(ALL, { level: 'all', query: 'di' }))).toEqual(['経', '行']);
    expect(ids(filterKanji(ALL, { level: 'all', query: 'cứu' }))).toEqual(['済']);
  });

  it('matches On and Kun readings, the okurigana dot ignored', () => {
    expect(ids(filterKanji(ALL, { level: 'all', query: 'ケイ' }))).toEqual(['経']);
    // Typed in the other script (review of #260): けい finds the On ケイ, ヘル the Kun へ.る.
    expect(ids(filterKanji(ALL, { level: 'all', query: 'けい' }))).toEqual(['経']);
    expect(ids(filterKanji(ALL, { level: 'all', query: 'ヘル' }))).toEqual(['経']);
    expect(ids(filterKanji(ALL, { level: 'all', query: 'いく' }))).toEqual(['行']);
  });
});

describe('isKanjiLevelFilter', () => {
  it('accepts the filters the tab offers and nothing else', () => {
    expect(['all', 'N1', 'none'].every(isKanjiLevelFilter)).toBe(true);
    expect(isKanjiLevelFilter('N6')).toBe(false);
  });
});
