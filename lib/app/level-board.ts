import type { UserDb } from '@/lib/db/user-db';
import { prisma } from '@/lib/db/db';
import { kanjiCatalog } from '@/lib/kanji/load';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import { tallyLevels, type LevelBoard } from '@/lib/library/level-tally';
import { OPENJLPT_ORIGIN, PUBLIC, type LibraryClient } from '@/lib/library/shared';

// The Kho screen's level board for one learner (U4a, docs/plans/2026-11-14-u4-kho.md): every
// OpenJLPT grammar pattern and word, the kanji catalog, and the learner's items, counted by
// `tallyLevels`. Not wired into a page yet (U4b).

export interface KhoBoard extends LevelBoard {
  // The learner's own groups, shown with the items outside JLPT.
  groups: number;
}

export async function levelBoard(db: UserDb, library: LibraryClient = prisma): Promise<KhoBoard> {
  const [entries, kanji, items, groups] = await Promise.all([
    library.libraryEntry.findMany({
      where: { origin: OPENJLPT_ORIGIN, type: { in: [GRAMMAR_KIND, VOCAB_KIND] } },
      select: { type: true, expression: true, level: true, status: true },
    }),
    kanjiCatalog(),
    db.item.findMany({
      select: { kind: true, expression: true, suspended: true, srs: { select: { state: true } } },
    }),
    db.group.count(),
  ]);
  const board = tallyLevels(
    entries.map((e) => ({ ...e, listed: e.status === PUBLIC })),
    kanji,
    items.map((i) => ({ ...i, state: i.srs?.state ?? null })),
  );
  return { ...board, groups };
}
