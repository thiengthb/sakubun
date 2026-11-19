import type { UserDb } from '@/lib/db/user-db';
import { prisma } from '@/lib/db/db';
import { loadLevelOrder } from '@/lib/app/level-sets';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import { setOfWord, type KhoPlace } from '@/lib/library/kho-trail';
import { SET_SIZE } from '@/lib/library/level-sets';
import { sourceOf } from '@/lib/library/outside-shelves';
import { OPENJLPT_ORIGIN, PUBLIC, type LibraryClient } from '@/lib/library/shared';

// Where one of the learner's items hangs in Kho (KN1, docs/plans/2026-11-19-kho-navigation.md), so its
// page's trail leads back to the set it is in: a word OpenJLPT lists sits in its level's set, the
// same rule as the level board (an OpenJLPT entry with its kind and expression, listed or hidden);
// any other word or pattern sits under Ngoài JLPT by where it came from.
export async function itemPlace(
  item: { kind: string; expression: string; source: string },
  library: LibraryClient = prisma,
): Promise<KhoPlace> {
  if (item.kind !== GRAMMAR_KIND && item.kind !== VOCAB_KIND) return { way: 'kanji' };
  const entries = await library.libraryEntry.findMany({
    where: { origin: OPENJLPT_ORIGIN, type: item.kind, expression: item.expression },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { level: true, status: true },
  });
  if (entries.length === 0) return { way: 'outside', source: sourceOf(item.source) };
  // A word listed in two levels counts in the first, as on the board; one only hidden counts nowhere.
  const entry = entries.find((e) => e.status === PUBLIC && e.level);
  if (!entry?.level) return { way: 'levels' };
  const kind = item.kind === VOCAB_KIND ? 'vocab' : 'grammar';
  const order = await loadLevelOrder(entry.level, item.kind, library);
  const set = setOfWord(
    order.map((e) => e.expression),
    item.expression,
    SET_SIZE,
  );
  return { way: 'levels', level: entry.level, kind, ...(set ? { set } : {}) };
}

/** The place of the learner's item `id`; null when they have no such item. */
export async function itemPlaceById(
  db: UserDb,
  id: string,
  library: LibraryClient = prisma,
): Promise<KhoPlace | null> {
  const item = await db.item.findUnique({
    where: { id },
    select: { kind: true, expression: true, source: true },
  });
  return item ? itemPlace(item, library) : null;
}
