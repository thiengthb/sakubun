// KJ2 (docs/plans/2026-11-08-kanji.md): one entry per Jōyō kanji, as the app shows it: the data
// scripts/kanji/build.py wrote, with its Vietnamese meaning from data/kanji/meanings-vi.json. Pure:
// the parsed files in, the entries out; lib/kanji/load.ts reads the files.
import type { KanjiRow, RadicalRow } from '@/lib/kanji/data';

export interface KanjiEntry {
  kanji: string;
  /** Upper case, as the cards show it: KINH. */
  hanviet: string;
  /** Empty only while a meaning is still missing from the file. */
  meaningVi: string;
  level: KanjiRow['level'];
  strokes: number;
  freq: number | null;
  on: string[];
  kun: string[];
  radical: { number: number; radical: string; nameVi: string };
  parts: string[];
  phon: string | null;
}

export function buildKanjiCatalog(
  rows: readonly KanjiRow[],
  meanings: Readonly<Record<string, string>>,
  radicals: readonly RadicalRow[],
): KanjiEntry[] {
  const radical = new Map(radicals.map((r) => [r.number, r]));
  return rows.map((r) => {
    const rad = radical.get(r.radical);
    return {
      kanji: r.kanji,
      hanviet: r.hanviet.toUpperCase(),
      meaningVi: meanings[r.kanji] ?? '',
      level: r.level,
      strokes: r.strokes,
      freq: r.freq,
      on: r.on,
      kun: r.kun,
      radical: { number: r.radical, radical: rad?.radical ?? '', nameVi: rad?.nameVi ?? '' },
      parts: r.parts,
      phon: r.phon,
    };
  });
}

const LEVEL_ORDER = ['N5', 'N4', 'N3', 'N2', 'N1'];

/** Easiest level first, then the most used first; kanji no OpenJLPT word uses come last. */
export function compareKanji(a: KanjiEntry, b: KanjiEntry): number {
  const level = (e: KanjiEntry) => (e.level ? LEVEL_ORDER.indexOf(e.level) : LEVEL_ORDER.length);
  return (
    level(a) - level(b) ||
    (a.freq ?? Number.MAX_SAFE_INTEGER) - (b.freq ?? Number.MAX_SAFE_INTEGER) ||
    a.strokes - b.strokes
  );
}
