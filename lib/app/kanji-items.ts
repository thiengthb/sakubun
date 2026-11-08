import type { UserDb } from '@/lib/db/user-db';
import { CARD_STATE } from '@/lib/domain/queue';
import type { KanjiEntry } from '@/lib/kanji/catalog';
import { rankNewKanji } from '@/lib/kanji/introduce';
import { KANJI_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import { newSrsFields } from '@/lib/srs/srs';

// A learner's kanji cards (KJ3, KJ5): made from the catalog when Ôn nhanh brings a kanji in, or when
// a whole level is taken from Kho chung. Either way they wait as new cards, and Ôn nhanh meets them
// in the order they were made, at the learner's daily new-kanji pace.

/** The kanji the learner already has a card for. */
export async function ownedKanji(db: UserDb): Promise<Set<string>> {
  const have = await db.item.findMany({ where: { kind: KANJI_KIND }, select: { expression: true } });
  return new Set(have.map((k) => k.expression));
}

/** The catalog ranked for this learner: kanji of the words they have started first. */
export async function rankedNewKanji(
  db: UserDb,
  catalog: readonly KanjiEntry[],
  have: ReadonlySet<string>,
): Promise<KanjiEntry[]> {
  const started = await db.item.findMany({
    where: { kind: VOCAB_KIND, srs: { state: { not: CARD_STATE.NEW } } },
    select: { expression: true },
  });
  return rankNewKanji(
    catalog,
    started.map((w) => w.expression),
    have,
  );
}

/**
 * New kanji cards, one millisecond apart so they come up in the order given. Returns how many were
 * made: none when another request made the same ones a moment before (both are kept as one).
 */
export async function createKanjiItems(
  db: UserDb,
  kanji: readonly KanjiEntry[],
  now: Date,
): Promise<number> {
  if (kanji.length === 0) return 0;
  const creates = kanji.map((k, i) =>
    db.item.create({
      data: {
        userId: db.$ownerId(),
        kind: KANJI_KIND,
        expression: k.kanji,
        hanviet: k.hanviet,
        meaningVi: k.meaningVi || k.hanviet,
        // A kanji no OpenJLPT word uses is as rare as N1.
        level: k.level ?? 'N1',
        source: 'JOYO',
        createdAt: new Date(now.getTime() + i),
        srs: { create: { ...newSrsFields(now), userId: db.$ownerId() } },
      },
    }),
  );
  try {
    await db.$transaction(creates);
    return creates.length;
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') return 0;
    throw e;
  }
}
