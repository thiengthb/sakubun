import type { UserDb } from '@/lib/db/user-db';
import { prisma } from '@/lib/db/db';
import { levelSets, type LevelSets } from '@/lib/library/level-sets';
import type { BoardLevel } from '@/lib/library/level-tally';
import {
  OPENJLPT_ORIGIN,
  PUBLIC,
  openJlptGroupKey,
  type ItemType,
  type LibraryClient,
} from '@/lib/library/shared';

// One level of one kind for the learner, cut into sets (U4c1, docs/plans/2026-11-14-u4-kho.md).
// The entries are the ones the level board counts (listed OpenJLPT entries of that level and
// kind), so a cell and its screen agree. They follow the order of the level's group ("N5 · Từ
// vựng"), whether or not an admin has hidden the group; an entry outside the group goes last.
// Not wired into a page yet (U4c2).
export async function loadLevelSets(
  db: UserDb,
  level: BoardLevel,
  kind: ItemType,
  now: Date = new Date(),
  library: LibraryClient = prisma,
): Promise<LevelSets> {
  const [ordered, items] = await Promise.all([
    loadLevelOrder(level, kind, library),
    db.item.findMany({
      where: { kind },
      select: {
        id: true,
        expression: true,
        suspended: true,
        srs: { select: { state: true, due: true, lapses: true } },
      },
    }),
  ]);
  return levelSets(
    ordered,
    items.map((i) => ({
      id: i.id,
      expression: i.expression,
      suspended: i.suspended,
      state: i.srs?.state ?? null,
      due: i.srs?.due ?? null,
      lapses: i.srs?.lapses ?? 0,
    })),
    now,
  );
}

/** A level's listed entries of one kind in the order its screen cuts them into sets. */
export async function loadLevelOrder(
  level: string,
  kind: ItemType,
  library: LibraryClient = prisma,
) {
  const [entries, order] = await Promise.all([
    library.libraryEntry.findMany({
      where: { origin: OPENJLPT_ORIGIN, type: kind, level, status: PUBLIC },
      orderBy: [{ expression: 'asc' }, { id: 'asc' }],
      select: { id: true, expression: true, reading: true, hanviet: true, meaningVi: true },
    }),
    library.libraryGroupMember.findMany({
      where: { group: { sourceKey: openJlptGroupKey(level, kind) } },
      select: { itemEntryId: true, position: true },
    }),
  ]);
  const position = new Map(order.map((m) => [m.itemEntryId, m.position]));
  const rank = (id: string) => position.get(id) ?? Number.MAX_SAFE_INTEGER;
  return (
    entries
      .flatMap(({ id, expression, ...rest }) => (expression ? [{ id, expression, ...rest }] : []))
      // Array.prototype.sort is stable, so entries outside the group keep their expression order.
      .sort((a, b) => rank(a.id) - rank(b.id))
  );
}
