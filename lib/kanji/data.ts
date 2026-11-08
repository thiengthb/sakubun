// KJ1 (docs/plans/2026-11-08-kanji.md): the kanji data scripts/kanji/build.py writes to data/kanji/.
// Nothing in the app reads it yet; this module names its shape and checks it, so a rebuild that
// drops a field or a kanji fails CI instead of a page later. Pure: the parsed files in, problems out.

export const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;

/** One Jōyō kanji. Readings follow KANJIDIC2 (a dot splits the okurigana: かた.る). */
export interface KanjiRow {
  kanji: string;
  /** Hán Việt, lower case; `hanvietSource` says which file gave it. */
  hanviet: string;
  hanvietSource: 'openjlpt' | 'kanjidic2';
  /** The easiest OpenJLPT level of a word written with it; null when no word uses it. */
  level: (typeof JLPT_LEVELS)[number] | null;
  /** 1-6 for the kanji taught in primary school, 8 for the rest of the Jōyō list. */
  grade: number;
  /** Rank among the 2,500 most used kanji in newspapers; null past that. */
  freq: number | null;
  strokes: number;
  /** Kangxi radical number, 1-214 (data/kanji/radicals.json). */
  radical: number;
  /** Its direct parts in KanjiVG (語: 言, 吾); empty for a kanji KanjiVG does not split. */
  parts: string[];
  /** The part KanjiVG marks as giving the sound (語: 吾), often sharing the Hán Việt reading. */
  phon: string | null;
  on: string[];
  kun: string[];
  meaningEn: string[];
  /** Set when KanjiVG draws the glyph with another stroke count than KANJIDIC2 lists (餅). */
  strokeCountNote?: string;
}

export interface RadicalRow {
  number: number;
  radical: string;
  nameVi: string;
  meaningVi: string;
  /** How it looks inside a kanji or in Japanese (氵 for 水, 青 for 靑). */
  variants: string[];
  strokes: number;
  /** How many Jōyō kanji are listed under it. */
  joyo: number;
}

/** KanjiVG path data per kanji, one string per stroke, in writing order, on a 109 by 109 box. */
export type StrokeTable = Record<string, string[]>;

export const JOYO_COUNT = 2136;
const IDEOGRAPH = /^[㐀-鿿豈-﫿]$/u;

export function checkKanjiData(
  rows: KanjiRow[],
  strokes: StrokeTable,
  radicals: RadicalRow[],
): string[] {
  const problems: string[] = [];
  if (rows.length !== JOYO_COUNT) problems.push(`${rows.length} kanji, expected ${JOYO_COUNT}`);
  const seen = new Set<string>();
  for (const r of rows) {
    const at = r.kanji;
    if (!IDEOGRAPH.test(r.kanji)) problems.push(`${at}: not one kanji`);
    if (seen.has(r.kanji)) problems.push(`${at}: listed twice`);
    seen.add(r.kanji);
    if (!r.hanviet || r.hanviet !== r.hanviet.toLowerCase()) problems.push(`${at}: Hán Việt`);
    if (r.level !== null && !JLPT_LEVELS.includes(r.level))
      problems.push(`${at}: level ${r.level}`);
    if (!(r.radical >= 1 && r.radical <= 214)) problems.push(`${at}: radical ${r.radical}`);
    if (r.on.length + r.kun.length === 0) problems.push(`${at}: no reading`);
    if (r.phon !== null && !r.phon) problems.push(`${at}: empty sound part`);
    const drawn = strokes[r.kanji];
    if (!drawn?.length) problems.push(`${at}: no strokes`);
    else if (drawn.length !== r.strokes && !r.strokeCountNote)
      problems.push(`${at}: ${drawn.length} strokes drawn, ${r.strokes} listed`);
    if (drawn?.some((d) => !/^M/i.test(d))) problems.push(`${at}: a stroke is not a path`);
  }
  if (radicals.length !== 214) problems.push(`${radicals.length} radicals, expected 214`);
  radicals.forEach((r, i) => {
    if (r.number !== i + 1) problems.push(`radical ${i + 1}: numbered ${r.number}`);
    if (!r.nameVi || !r.meaningVi) problems.push(`radical ${r.number}: Vietnamese name`);
    if (!(r.strokes > 0)) problems.push(`radical ${r.number}: stroke count`);
  });
  const total = radicals.reduce((n, r) => n + r.joyo, 0);
  if (total !== rows.length) problems.push(`radicals count ${total} kanji, not ${rows.length}`);
  return problems;
}
