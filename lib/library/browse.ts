import { prisma } from '@/lib/db/db';
import type { UserDb } from '@/lib/db/user-db';
import type { BrowseQuery } from '@/lib/library/browse-query';
import { likedEntries } from '@/lib/library/likes';
import { countEntries, searchEntries, type SearchQuery } from '@/lib/library/shared';
import { ownedExpressions, ownedItems } from '@/lib/library/take';

// "Từng mục" on Kho chung for one learner (7.4i): a page of entries with what the learner has and
// likes, the first page with the real totals, the next ones as the list scrolls.

export interface LibraryEntryRow {
  id: string;
  type: string;
  expression: string | null;
  reading: string | null;
  meaningVi: string | null;
  level: string | null;
  origin: string;
  takeCount: number;
  likes: number;
  liked: boolean;
  // The learner's own copy, when they have one (same kind and expression).
  itemId: string | null;
}

export async function browseEntries(
  db: UserDb,
  query: BrowseQuery,
  skip = 0,
): Promise<{ rows: LibraryEntryRow[]; counts: Awaited<ReturnType<typeof countEntries>> | null }> {
  const search: SearchQuery = {
    text: query.q,
    type: query.type === 'all' ? undefined : query.type,
    level: query.level === 'all' ? undefined : query.level,
    sort: query.sort,
    exclude: query.hideOwned ? await ownedExpressions(db) : undefined,
    skip,
  };
  const [entries, counts] = await Promise.all([
    searchEntries(prisma, search),
    skip === 0 ? countEntries(prisma, search) : null,
  ]);
  const [owned, liked] = await Promise.all([
    ownedItems(db, entries),
    likedEntries(
      db,
      entries.map((e) => e.id),
    ),
  ]);
  return {
    rows: entries.map((e) => ({
      id: e.id,
      type: e.type,
      expression: e.expression,
      reading: e.reading,
      meaningVi: e.meaningVi,
      level: e.level,
      origin: e.origin,
      takeCount: e.takeCount,
      likes: e._count.likes,
      liked: liked.has(e.id),
      itemId: owned.get(e.id) ?? null,
    })),
    counts,
  };
}
