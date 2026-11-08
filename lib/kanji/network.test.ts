import { describe, expect, it } from 'vitest';
import { kanjiNetwork, partIndex } from '@/lib/kanji/network';
import type { KanjiEntry } from '@/lib/kanji/catalog';
import type { RadicalRow } from '@/lib/kanji/data';

const entry = (
  kanji: string,
  hanviet: string,
  parts: string[],
  extra: Partial<KanjiEntry> = {},
): KanjiEntry => ({
  kanji,
  hanviet,
  meaningVi: '',
  level: 'N3',
  strokes: 10,
  freq: null,
  on: [],
  kun: [],
  radical: { number: 1, radical: '', nameVi: '' },
  parts,
  phon: null,
  ...extra,
});

const CATALOG = [
  entry('語', 'NGỮ', ['言', '吾'], { phon: '吾', level: 'N5', freq: 300 }),
  entry('悟', 'NGỘ', ['忄', '吾'], { phon: '吾', level: 'N1' }),
  entry('言', 'NGÔN', [], { level: 'N5', freq: 100 }),
  entry('話', 'THOẠI', ['言', '舌'], { level: 'N5', freq: 200 }),
  entry('吾', 'NGÔ', ['五', '口']),
];
const RADICALS: RadicalRow[] = [
  {
    number: 61,
    radical: '心',
    nameVi: 'tâm',
    meaningVi: 'tim',
    variants: ['忄'],
    strokes: 4,
    joyo: 0,
  },
];

describe('kanjiNetwork', () => {
  const index = partIndex(CATALOG);

  it('puts the parts around the kanji, each with the other kanji built with it, easiest first', () => {
    const net = kanjiNetwork(CATALOG[0], CATALOG, index, RADICALS);
    expect(net.center.kanji).toBe('語');
    expect(net.parts.map((p) => [p.part, p.name, p.sound])).toEqual([
      ['言', 'NGÔN', false],
      ['吾', 'NGÔ', true],
    ]);
    expect(net.parts[0].kanji.map((k) => k.kanji)).toEqual(['話']);
    expect(net.parts[1].kanji.map((k) => k.kanji)).toEqual(['悟']);
  });

  it('names a radical form from the radicals, and a part outside both by nothing', () => {
    const net = kanjiNetwork(CATALOG[1], CATALOG, index, RADICALS);
    expect(net.parts[0]).toMatchObject({ part: '忄', name: 'tâm', entry: null, kanji: [] });
    const wu = kanjiNetwork(CATALOG[4], CATALOG, index, RADICALS);
    expect(wu.parts.map((p) => [p.part, p.name])).toEqual([
      ['五', null],
      ['口', null],
    ]);
  });

  it('gives a kanji KanjiVG does not split no parts', () => {
    expect(kanjiNetwork(CATALOG[2], CATALOG, index, RADICALS).parts).toEqual([]);
  });
});
