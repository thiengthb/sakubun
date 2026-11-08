import { describe, expect, it } from 'vitest';
import type { KanjiEntry } from '@/lib/kanji/catalog';
import { rankNewKanji } from '@/lib/kanji/introduce';

const entry = (kanji: string, level: KanjiEntry['level'], freq: number | null): KanjiEntry => ({
  kanji,
  hanviet: '',
  meaningVi: '',
  level,
  strokes: 5,
  freq,
  on: [],
  kun: [],
  radical: { number: 1, radical: '一', nameVi: '' },
  parts: [],
  phon: null,
});

const CATALOG = [
  entry('日', 'N5', 1),
  entry('一', 'N5', 2),
  entry('済', 'N3', 300),
  entry('経', 'N3', 200),
  entry('験', 'N3', 400),
  entry('璽', null, null),
];
const order = (list: KanjiEntry[]) => list.map((k) => k.kanji).join('');

describe('rankNewKanji', () => {
  it('follows the catalog when no word is started', () => {
    expect(order(rankNewKanji(CATALOG, [], new Set()))).toBe('日一経済験璽');
  });

  it('puts the kanji of started words first, the most shared first, a word counted once', () => {
    const ranked = rankNewKanji(CATALOG, ['経済', '経験', '済む済む'], new Set());
    expect(order(ranked)).toBe('経済験日一璽');
  });

  it('leaves out kanji the learner already has', () => {
    expect(order(rankNewKanji(CATALOG, ['経済'], new Set(['経', '日'])))).toBe('済一験璽');
  });
});
