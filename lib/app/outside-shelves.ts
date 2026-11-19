import type { UserDb } from '@/lib/db/user-db';
import { prisma } from '@/lib/db/db';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import {
  jlptKey,
  outsideItems,
  outsideShelves,
  sourceOf,
  type OutsideItem,
  type OutsideShelves,
  type OutsideSource,
} from '@/lib/library/outside-shelves';
import { OPENJLPT_ORIGIN, type LibraryClient } from '@/lib/library/shared';

// The learner's items and groups for the "Ngoài JLPT" page (U4e, docs/plans/2026-11-14-u4-kho.md).
// An item is outside JLPT when no OpenJLPT entry has its kind and expression, listed or hidden,
// the same rule as the level board's "Ngoài JLPT" count (level-tally.ts). Kanji items are read too,
// as a group may hold them; they are never outside JLPT.

async function load(db: UserDb, library: LibraryClient) {
  const [entries, items] = await Promise.all([
    library.libraryEntry.findMany({
      where: { origin: OPENJLPT_ORIGIN, type: { in: [GRAMMAR_KIND, VOCAB_KIND] } },
      select: { type: true, expression: true },
    }),
    db.item.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        kind: true,
        expression: true,
        reading: true,
        meaningVi: true,
        source: true,
        suspended: true,
        srs: { select: { state: true, due: true, lapses: true } },
      },
    }),
  ]);
  const jlpt = new Set(
    entries.flatMap((e) => (e.expression ? [jlptKey(e.type, e.expression)] : [])),
  );
  const rows: OutsideItem[] = items.map(({ srs, ...i }) => ({
    ...i,
    state: srs?.state ?? null,
    due: srs?.due ?? null,
    lapses: srs?.lapses ?? 0,
  }));
  return { jlpt, rows };
}

export async function loadOutsideShelves(
  db: UserDb,
  now: Date = new Date(),
  library: LibraryClient = prisma,
): Promise<OutsideShelves> {
  const [{ jlpt, rows }, groups] = await Promise.all([
    load(db, library),
    db.group.findMany({
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: { id: true, name: true, members: { select: { itemId: true } } },
    }),
  ]);
  return outsideShelves(
    rows,
    jlpt,
    groups.map((g) => ({ id: g.id, name: g.name, itemIds: g.members.map((m) => m.itemId) })),
    now,
  );
}

/** The items outside JLPT that came from one source, oldest first. */
export async function loadOutsideItems(
  db: UserDb,
  source: OutsideSource,
  library: LibraryClient = prisma,
): Promise<OutsideItem[]> {
  const { jlpt, rows } = await load(db, library);
  return outsideItems(rows, jlpt).filter((i) => sourceOf(i.source) === source);
}
