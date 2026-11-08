// Which kanji come next in Ôn nhanh (KJ3, docs/plans/2026-11-08-kanji.md › Tóm tắt): the kanji in
// the most words the learner has started come first, so 経 arrives once 経済 and 経験 are being
// learned; the rest follow the learner's vocabulary level from Cài đặt (thien, 2026-11-08: "tùy theo
// cài đặt của tôi"): that level first, then the easier ones down to N5, then the harder ones, and
// inside a level the most used, then the fewest strokes. Pure: the catalog and the learner's words
// in, the order out.
import { compareKanji, type KanjiEntry } from '@/lib/kanji/catalog';
import { JLPT_LEVELS } from '@/lib/kanji/data';

type Level = (typeof JLPT_LEVELS)[number];

/** The levels in the order new kanji are met from `from`: it, easier ones, then harder ones. */
export function kanjiLevelOrder(from: Level): Level[] {
  const at = JLPT_LEVELS.indexOf(from);
  return [...JLPT_LEVELS.slice(0, at + 1).reverse(), ...JLPT_LEVELS.slice(at + 1)];
}

export function rankNewKanji(
  catalog: readonly KanjiEntry[],
  startedWords: readonly string[],
  taken: ReadonlySet<string>,
  from: Level = 'N5',
): KanjiEntry[] {
  const inWords = new Map<string, number>();
  for (const word of startedWords)
    for (const char of new Set(word)) inWords.set(char, (inWords.get(char) ?? 0) + 1);
  const order = kanjiLevelOrder(from);
  // A kanji no JLPT list uses comes after every level.
  const rank = (k: KanjiEntry) => (k.level ? order.indexOf(k.level) : order.length);
  return catalog
    .filter((k) => !taken.has(k.kanji))
    .sort(
      (a, b) =>
        (inWords.get(b.kanji) ?? 0) - (inWords.get(a.kanji) ?? 0) ||
        rank(a) - rank(b) ||
        compareKanji(a, b),
    );
}
