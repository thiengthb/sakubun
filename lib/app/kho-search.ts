import type { UserDb } from '@/lib/db/user-db';
import { prisma } from '@/lib/db/db';
import { sameExpression, stripDecoration } from '@/lib/core/normalize';
import { asItemKind, ITEM_KINDS, type ItemKind } from '@/lib/library/item-kinds';
import { wordState, type WordState } from '@/lib/library/level-sets';
import { countEntries, searchEntries, type LibraryClient } from '@/lib/library/shared';
import { browseParams } from '@/lib/library/browse-query';
import { ownedExpressions } from '@/lib/library/take';

// Kho's search box (U4f, layout B that thien picked on 19/11, docs/plans/2026-11-14-u4-kho.md): one
// query over the learner's own words and patterns, and over Kho chung minus what they already have,
// so a hit in Kho chung is always something to "Học".

/** Rows each side shows; the counts say how many there are in all. */
export const MINE_SHOWN = 6;
export const LIBRARY_SHOWN = 6;
// A query as short as one kana matches thousands of the learner's items; past this they are counted
// as "200+" and the rest are not read.
export const MINE_SCAN = 200;

export interface MineHit {
  id: string;
  kind: ItemKind;
  expression: string;
  reading: string | null;
  meaningVi: string;
  level: string;
  state: WordState;
}

export interface LibraryHit {
  id: string;
  kind: ItemKind;
  expression: string;
  reading: string | null;
  meaningVi: string;
  level: string | null;
}

export interface KhoSearch {
  query: string;
  mine: MineHit[];
  mineCount: number;
  /** True when the learner has more matches than MINE_SCAN. */
  mineMore: boolean;
  library: LibraryHit[];
  libraryCount: number;
  /** Kho chung's page with the same search and "Ẩn mục đã có" on. */
  libraryHref: string;
}

export const searchNeedle = (raw: string) => stripDecoration(raw.normalize('NFKC'));

export async function searchKho(
  db: UserDb,
  raw: string,
  now: Date = new Date(),
  library: LibraryClient = prisma,
): Promise<KhoSearch> {
  const query = searchNeedle(raw);
  const libraryHref = `/library?${browseParams({ q: query, type: 'all', level: 'all', sort: 'popular', hideOwned: true })}`;
  if (!query)
    return {
      query,
      mine: [],
      mineCount: 0,
      mineMore: false,
      library: [],
      libraryCount: 0,
      libraryHref,
    };

  // Everything the learner owns is left out of Kho chung's side, not just what matches here: their 会う
  // with no reading still hides Kho chung's 会う (あう) on a search for あう. Same rule as "Ẩn mục đã có".
  const [owned, exclude] = await Promise.all([
    db.item.findMany({
      where: {
        kind: { in: [...ITEM_KINDS] },
        OR: [
          { expression: { contains: query } },
          { reading: { contains: query } },
          { meaningVi: { contains: query } },
        ],
      },
      select: {
        id: true,
        kind: true,
        expression: true,
        reading: true,
        meaningVi: true,
        level: true,
        suspended: true,
        srs: { select: { state: true, due: true, lapses: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: MINE_SCAN + 1,
    }),
    ownedExpressions(db),
  ]);
  const mineMore = owned.length > MINE_SCAN;
  const scanned = owned.slice(0, MINE_SCAN);
  const [entries, counts] = await Promise.all([
    searchEntries(library, { text: query, exclude, take: LIBRARY_SHOWN }),
    countEntries(library, { text: query, exclude }),
  ]);

  // The exact word first, then the shortest: typing 会 should put 会う before 会議室.
  const rank = (r: { expression: string; reading: string | null }) =>
    sameExpression(r.expression, query) || r.reading === query ? 0 : 1;
  const mine = scanned
    .map((r) => ({ r, rank: rank(r) }))
    .sort((a, b) => a.rank - b.rank || a.r.expression.length - b.r.expression.length)
    .slice(0, MINE_SHOWN)
    .map(({ r }) => ({
      id: r.id,
      kind: asItemKind(r.kind),
      expression: r.expression,
      reading: r.reading,
      meaningVi: r.meaningVi,
      level: r.level,
      state: wordState(
        {
          id: r.id,
          expression: r.expression,
          suspended: r.suspended,
          state: r.srs?.state ?? null,
          due: r.srs?.due ?? null,
          lapses: r.srs?.lapses ?? 0,
        },
        now,
      ),
    }));

  return {
    query,
    mine,
    mineCount: scanned.length,
    mineMore,
    library: entries.map((e) => ({
      id: e.id,
      kind: asItemKind(e.type),
      expression: e.expression ?? '',
      reading: e.reading,
      meaningVi: e.meaningVi ?? '',
      level: e.level,
    })),
    libraryCount: Object.values(counts).reduce((a, b) => a + b, 0),
    libraryHref,
  };
}
