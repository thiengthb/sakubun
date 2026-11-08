// Which kanji come next in Ôn nhanh (KJ3, docs/plans/2026-11-08-kanji.md › Tóm tắt): the kanji in
// the most words the learner has started come first, so 経 arrives once 経済 and 経験 are being
// learned; the rest follow the catalog (easiest level, then the most used, then the fewest
// strokes). Pure: the catalog and the learner's words in, the order out.
import { compareKanji, type KanjiEntry } from '@/lib/kanji/catalog';

export function rankNewKanji(
  catalog: readonly KanjiEntry[],
  startedWords: readonly string[],
  taken: ReadonlySet<string>,
): KanjiEntry[] {
  const inWords = new Map<string, number>();
  for (const word of startedWords)
    for (const char of new Set(word)) inWords.set(char, (inWords.get(char) ?? 0) + 1);
  return catalog
    .filter((k) => !taken.has(k.kanji))
    .sort(
      (a, b) => (inWords.get(b.kanji) ?? 0) - (inWords.get(a.kanji) ?? 0) || compareKanji(a, b),
    );
}
