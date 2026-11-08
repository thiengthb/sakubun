import { describe, expect, it } from 'vitest';
import { buildKanjiCatalog, compareKanji } from '@/lib/kanji/catalog';
import type { KanjiRow, RadicalRow } from '@/lib/kanji/data';
import { kanjiCatalog } from '@/lib/kanji/load';

const row = (kanji: string, over: Partial<KanjiRow> = {}): KanjiRow => ({
  kanji,
  hanviet: 'kinh',
  hanvietSource: 'openjlpt',
  level: 'N3',
  grade: 5,
  freq: 100,
  strokes: 11,
  radical: 120,
  parts: ['糸', '圣'],
  phon: '圣',
  on: ['ケイ'],
  kun: ['へ.る'],
  meaningEn: ['sutra'],
  ...over,
});
const RADICAL: RadicalRow = {
  number: 120,
  radical: '糸',
  nameVi: 'mịch',
  meaningVi: 'sợi tơ',
  variants: ['糹'],
  strokes: 6,
  joyo: 0,
};

describe('buildKanjiCatalog', () => {
  it('joins the meaning and the radical, Hán Việt in upper case', () => {
    expect(buildKanjiCatalog([row('経')], { 経: 'đi qua; trải qua' }, [RADICAL])).toEqual([
      expect.objectContaining({
        kanji: '経',
        hanviet: 'KINH',
        meaningVi: 'đi qua; trải qua',
        radical: { number: 120, radical: '糸', nameVi: 'mịch' },
        parts: ['糸', '圣'],
      }),
    ]);
    expect(buildKanjiCatalog([row('経')], {}, [])[0]).toMatchObject({
      meaningVi: '',
      radical: { radical: '', nameVi: '' },
    });
  });

  it('orders by level, then by how often the kanji is used', () => {
    const entries = buildKanjiCatalog(
      [
        row('a', { level: null }),
        row('b', { level: 'N5', freq: 9 }),
        row('c', { level: 'N5', freq: 2 }),
        row('d', { level: 'N4', freq: null }),
      ],
      {},
      [],
    );
    expect(entries.sort(compareKanji).map((e) => e.kanji)).toEqual(['c', 'b', 'd', 'a']);
  });

  it('gives every committed Jōyō kanji a meaning and a named radical', async () => {
    const catalog = await kanjiCatalog();
    expect(catalog).toHaveLength(2136);
    expect(catalog.filter((e) => !e.meaningVi || !e.radical.nameVi)).toEqual([]);
    expect(catalog.find((e) => e.kanji === '日')).toMatchObject({
      hanviet: 'NHẬT',
      meaningVi: 'mặt trời; ngày; Nhật Bản',
      level: 'N5',
    });
  });
});
