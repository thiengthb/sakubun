import type { UserDb } from '@/lib/db/user-db';
import { sameExpression, stripDecoration } from '@/lib/core/normalize';
import { asItemKind, GRAMMAR_KIND, VOCAB_KIND, type ItemKind } from '@/lib/library/item-kinds';
import { addItems, type ItemInput } from '@/lib/library/practice';

// Library reads and writes for the v2 MCP tools: find an item by what the learner typed, and add new
// ones. Results stay small because every row is read by a model.

export const MAX_FOUND = 5;
const SCAN = 30;

export interface FoundItem {
  itemId: string;
  kind: ItemKind;
  expression: string;
  reading: string | null;
  meaningVi: string;
  level: string;
  // ts-fsrs state, null when the item has no schedule row.
  state: number | null;
  suspended: boolean;
}

export async function findItems(db: UserDb, query: string, kind?: ItemKind): Promise<FoundItem[]> {
  const needle = stripDecoration(query.normalize('NFKC'));
  if (!needle) return [];
  const rows = await db.item.findMany({
    where: {
      ...(kind ? { kind } : {}),
      OR: [
        { expression: { contains: needle } },
        { reading: { contains: needle } },
        { meaningVi: { contains: needle } },
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
      srs: { select: { state: true } },
    },
    take: SCAN,
  });
  const rank = (r: (typeof rows)[number]) =>
    sameExpression(r.expression, needle) || r.reading === needle ? 0 : 1;
  return rows
    .sort((a, b) => rank(a) - rank(b) || a.expression.length - b.expression.length)
    .slice(0, MAX_FOUND)
    .map((r) => ({
      itemId: r.id,
      kind: asItemKind(r.kind),
      expression: r.expression,
      reading: r.reading,
      meaningVi: r.meaningVi,
      level: r.level,
      state: r.srs?.state ?? null,
      suspended: r.suspended,
    }));
}

export interface AddedItems {
  added: number;
  skipped: { expression: string; reason: string }[];
}

export async function addLibraryItems(
  db: UserDb,
  kind: ItemKind,
  entries: ItemInput[],
): Promise<AddedItems> {
  const result = await addItems(db, entries, 'MCP', kind === 'VOCAB' ? VOCAB_KIND : GRAMMAR_KIND);
  return { added: result.created, skipped: result.skipped };
}
