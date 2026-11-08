import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkKanjiData, type KanjiRow, type RadicalRow, type StrokeTable } from '@/lib/kanji/data';

const read = <T>(name: string): T => JSON.parse(readFileSync(`data/kanji/${name}`, 'utf8')) as T;
const rows = read<KanjiRow[]>('kanji.json');
const strokes = read<StrokeTable>('strokes.json');
const radicals = read<RadicalRow[]>('radicals.json');
const by = new Map(rows.map((r) => [r.kanji, r]));

describe('data/kanji', () => {
  // CI keeps a rebuild of scripts/kanji/build.py honest.
  it('passes its own checks', () => {
    expect(checkKanjiData(rows, strokes, radicals)).toEqual([]);
  });

  it('splits a kanji into parts and finds the part that gives its sound', () => {
    expect(by.get('語')).toMatchObject({
      hanviet: 'ngữ',
      level: 'N5',
      radical: 149,
      parts: ['言', '吾'],
      phon: '吾',
      on: ['ゴ'],
    });
    // The same sound part runs through a family of kanji, and so does the Hán Việt.
    const family = rows.filter((r) => r.phon === '青').map((r) => `${r.kanji} ${r.hanviet}`);
    expect(family).toEqual(expect.arrayContaining(['晴 tình', '清 thanh', '精 tinh', '請 thỉnh']));
  });

  it('draws strokes in the Japanese order', () => {
    // Japanese writes 右 falling stroke first and 左 flat stroke first. The falling stroke starts near
    // the top of the box, the flat one near its middle.
    const startY = (k: string, i: number) => Number(/^M[\d.]+,([\d.]+)/.exec(strokes[k][i])?.[1]);
    expect(startY('右', 0)).toBeLessThan(30);
    expect(startY('右', 1)).toBeGreaterThan(35);
    expect(startY('左', 0)).toBeGreaterThan(35);
    expect(startY('左', 1)).toBeLessThan(30);
  });

  it('names every radical in Vietnamese, with its forms inside kanji', () => {
    expect(radicals[84]).toMatchObject({ radical: '水', nameVi: 'thủy', variants: ['氵'] });
    expect(radicals.find((r) => r.number === 149)?.nameVi).toBe('ngôn');
  });

  it('notices a kanji missing its strokes or its Hán Việt', () => {
    const broken = rows.map((r) => (r.kanji === '語' ? { ...r, hanviet: '' } : r));
    const { 語: _, ...less } = strokes;
    expect(checkKanjiData(broken, less, radicals)).toEqual(['語: Hán Việt', '語: no strokes']);
    expect(checkKanjiData(rows.slice(1), strokes, radicals)).toEqual(
      expect.arrayContaining(['2135 kanji, expected 2136']),
    );
  });
});
