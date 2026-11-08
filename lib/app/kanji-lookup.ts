import type { UserDb } from '@/lib/db/user-db';
import type { KanjiEntry } from '@/lib/kanji/catalog';
import { kanjiCatalog } from '@/lib/kanji/load';
import { KANJI_KIND } from '@/lib/library/item-kinds';

// MCP `lookup` on kanji (KJ5): each Jōyō kanji in the query, so Claude can explain 経 in 経済 from
// the app's own data (Hán Việt, meaning, readings, radical, parts) and say whether the learner is
// studying it.

/** At most this many kanji a lookup, so a long query keeps the answer short. */
export const LOOKUP_KANJI_MAX = 4;

export interface FoundKanji {
  kanji: KanjiEntry;
  /** The learner's card for it: its FSRS state, or null when they have none. */
  state: number | null;
}

export async function lookupKanji(db: UserDb, query: string): Promise<FoundKanji[]> {
  const chars = [...new Set(query)];
  const catalog = await kanjiCatalog();
  const byChar = new Map(catalog.map((k) => [k.kanji, k]));
  const kanji = chars
    .map((c) => byChar.get(c))
    .filter((k): k is KanjiEntry => !!k)
    .slice(0, LOOKUP_KANJI_MAX);
  if (kanji.length === 0) return [];
  const cards = await db.item.findMany({
    where: { kind: KANJI_KIND, expression: { in: kanji.map((k) => k.kanji) } },
    select: { expression: true, srs: { select: { state: true } } },
  });
  const state = new Map(cards.map((c) => [c.expression, c.srs?.state ?? null]));
  return kanji.map((k) => ({ kanji: k, state: state.get(k.kanji) ?? null }));
}
