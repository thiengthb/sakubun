// The Kanji tab of Tài nguyên (KJ2, docs/plans/2026-11-08-kanji.md): which kanji of the catalog
// a level and a search keep. Pure: the entries in, the ones to show out, in catalog order.
import type { KanjiEntry } from '@/lib/kanji/catalog';
import { JLPT_LEVELS } from '@/lib/kanji/data';

/** A JLPT level, every level, or the kanji no OpenJLPT word uses. */
export type KanjiLevelFilter = 'all' | (typeof JLPT_LEVELS)[number] | 'none';

export const KANJI_LEVEL_FILTERS: readonly { value: KanjiLevelFilter; label: string }[] = [
  { value: 'all', label: 'Mọi cấp' },
  ...JLPT_LEVELS.map((l) => ({ value: l, label: l })),
  { value: 'none', label: 'Khác' },
];

export function isKanjiLevelFilter(value: string): value is KanjiLevelFilter {
  return KANJI_LEVEL_FILTERS.some((f) => f.value === value);
}

// Lower case without tones, so "kinh" finds KINH and KÍNH, and "di" finds ĐI.
const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase();
const hasTone = (text: string) => fold(text) !== text.toLowerCase();
const KANJI_CHAR = /\p{Script=Han}/u;
// On readings are written in katakana and Kun in hiragana; a learner types either for both.
const shiftKana = (text: string, from: RegExp, by: number) =>
  text.replace(from, (c) => String.fromCharCode(c.charCodeAt(0) + by));
const toKatakana = (text: string) => shiftKana(text, /[\u3041-\u3096]/g, 0x60);
const toHiragana = (text: string) => shiftKana(text, /[\u30a1-\u30f6]/g, -0x60);

/**
 * Typing kanji finds each one typed (経済 shows 経 and 済). Otherwise the text is looked for in the
 * Hán Việt, the Vietnamese meaning and the readings; typed without tones it matches any tone, typed
 * with tones it matches only those. Readings match in hiragana or katakana alike.
 */
export function filterKanji(
  entries: readonly KanjiEntry[],
  { level, query }: { level: KanjiLevelFilter; query: string },
): KanjiEntry[] {
  const byLevel =
    level === 'all'
      ? entries
      : entries.filter((e) => (level === 'none' ? e.level === null : e.level === level));
  const q = query.trim();
  if (!q) return [...byLevel];
  const typed = new Set([...q].filter((c) => KANJI_CHAR.test(c)));
  if (typed.size > 0) return byLevel.filter((e) => typed.has(e.kanji));
  const exact = hasTone(q);
  const norm = exact ? q.toLowerCase() : fold(q);
  const keep = (text: string) => (exact ? text.toLowerCase() : fold(text)).includes(norm);
  return byLevel.filter(
    (e) =>
      keep(e.hanviet) ||
      keep(e.meaningVi) ||
      e.on.some((r) => r.includes(toKatakana(q))) ||
      e.kun.some((r) => r.replace(/[.-]/g, '').includes(toHiragana(q))),
  );
}
