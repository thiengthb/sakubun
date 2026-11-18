import type { UserDb } from '@/lib/db/user-db';
import { prisma } from '@/lib/db/db';
import { levelSets, type LevelSets } from '@/lib/library/level-sets';
import type { BoardLevel } from '@/lib/library/level-tally';
import {
  findOpenJlptGroup,
  OPENJLPT_ORIGIN,
  PUBLIC,
  type ItemType,
  type LibraryClient,
} from '@/lib/library/shared';

// One level of one kind for the learner, cut into sets (U4c1, docs/plans/2026-11-14-u4-kho.md):
// the listed OpenJLPT entries of that level in the order of its level group ("N5 · Từ vựng"),
// and the learner's items of that kind. The same entries the level board counts, so a cell and
// its screen agree. Not wired into a page yet (U4c2).
export async function loadLevelSets(
  db: UserDb,
  level: BoardLevel,
  kind: ItemType,
  now: Date = new Date(),
  library: LibraryClient = prisma,
): Promise<LevelSets> {
  const group = await findOpenJlptGroup(library, level, kind);
  const [members, items] = await Promise.all([
    group
      ? library.libraryGroupMember.findMany({
          where: {
            groupEntryId: group.id,
            item: { origin: OPENJLPT_ORIGIN, type: kind, level, status: PUBLIC },
          },
          orderBy: { position: 'asc' },
          select: {
            item: { select: { expression: true, reading: true, hanviet: true, meaningVi: true } },
          },
        })
      : Promise.resolve([]),
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
  const entries = members.flatMap(({ item }) =>
    item.expression ? [{ ...item, expression: item.expression }] : [],
  );
  return levelSets(
    entries,
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
