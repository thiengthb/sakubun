import type { UserDb } from '@/lib/db/user-db';
import { createKanjiItems, ownedKanji, rankedNewKanji } from '@/lib/app/kanji-items';
import { compareKanji, type KanjiEntry } from '@/lib/kanji/catalog';
import { JLPT_LEVELS } from '@/lib/kanji/data';
import { kanjiCatalog } from '@/lib/kanji/load';

// Kho chung's kanji groups (KJ5, docs/plans/2026-11-08-kanji.md › Chỗ trong app): one per JLPT level,
// made from the catalog rather than stored, since every learner reads the same 2,136 kanji. Taking a
// level makes a card for each of its kanji the learner lacks; Ôn nhanh then meets them before the
// ones it would pick itself, at the learner's daily pace.

export type KanjiLevel = (typeof JLPT_LEVELS)[number];

export function isKanjiLevel(value: string): value is KanjiLevel {
  return (JLPT_LEVELS as readonly string[]).includes(value);
}

export interface KanjiLevelSummary {
  level: KanjiLevel;
  size: number;
  have: number;
}

const ofLevel = (catalog: readonly KanjiEntry[], level: KanjiLevel) =>
  catalog.filter((k) => k.level === level);

/** Each level's size and how many of its kanji the learner already has a card for. */
export async function kanjiLevels(db: UserDb): Promise<KanjiLevelSummary[]> {
  const [catalog, have] = await Promise.all([kanjiCatalog(), ownedKanji(db)]);
  return JLPT_LEVELS.map((level) => {
    const kanji = ofLevel(catalog, level);
    return { level, size: kanji.length, have: kanji.filter((k) => have.has(k.kanji)).length };
  });
}

/** One level's kanji, easiest first, each marked when the learner has it. */
export async function kanjiLevel(
  db: UserDb,
  level: KanjiLevel,
): Promise<{ kanji: KanjiEntry[]; have: Set<string> }> {
  const [catalog, have] = await Promise.all([kanjiCatalog(), ownedKanji(db)]);
  const kanji = ofLevel(catalog, level).sort(compareKanji);
  return { kanji, have: new Set(kanji.filter((k) => have.has(k.kanji)).map((k) => k.kanji)) };
}

export interface TakeKanjiLevelResult {
  added: number;
  /** The level's kanji the learner had before. */
  had: number;
}

/** Cards for the level's kanji the learner lacks, the kanji of their started words first. */
export async function takeKanjiLevel(
  db: UserDb,
  level: KanjiLevel,
  now = new Date(),
): Promise<TakeKanjiLevelResult> {
  const kanji = ofLevel(await kanjiCatalog(), level);
  // Ôn nhanh in another tab can bring one of them in between the read and the write, and then the
  // whole insert is dropped; read again once, so the rest still get their cards.
  for (let attempt = 0; ; attempt++) {
    const missing = await rankedNewKanji(db, kanji, await ownedKanji(db));
    const added = await createKanjiItems(db, missing, now);
    if (added > 0 || missing.length === 0 || attempt > 0)
      return { added, had: kanji.length - missing.length };
  }
}
