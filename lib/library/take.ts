import type { UserDb } from '@/lib/db/user-db';
import { err, ok, type ActionResult } from '@/lib/core/action-result';
import { addItemsToGroup, createGroup, type GroupKind } from '@/lib/library/groups';
import { isGroupKind } from '@/lib/library/group-kinds';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import { addItems } from '@/lib/library/practice';
import { countOwned } from '@/lib/library/progress';
import { GROUP_TYPE, VISIBLE, VISIBLE_MEMBER } from '@/lib/library/shared';

// Taking from the shared library (phase 8, L1b; plan rules 1, 2 and 8): an entry is copied into the
// learner's own items with a fresh schedule, as a new item joins the "new" queue under the daily
// limit. Nothing personal travels: no stars, notes of others, suspensions or review history.

export const LIBRARY_SOURCE = 'LIBRARY';

const GONE = 'Mục này không còn trên kho chung.';

type EntryContent = {
  id: string;
  type: string;
  expression: string | null;
  reading: string | null;
  hanviet: string | null;
  meaningVi: string | null;
  level: string | null;
  notes: string | null;
};

const CONTENT = {
  id: true,
  type: true,
  expression: true,
  reading: true,
  hanviet: true,
  meaningVi: true,
  level: true,
  notes: true,
} as const;

const keyOf = (kind: string, expression: string) => `${kind}\u0000${expression}`;

// The learner's items with the same kind and expression as these entries, by entry id: a learner
// has one item per kind and expression (rule 2), however they came by it.
export async function ownedItems(
  db: UserDb,
  entries: readonly Pick<EntryContent, 'id' | 'type' | 'expression'>[],
): Promise<Map<string, string>> {
  const items = await db.item.findMany({
    where: {
      OR: [GRAMMAR_KIND, VOCAB_KIND].map((kind) => ({
        kind,
        expression: {
          in: entries.filter((e) => e.type === kind && e.expression).map((e) => e.expression!),
        },
      })),
    },
    select: { id: true, kind: true, expression: true },
  });
  const byKey = new Map(items.map((i) => [keyOf(i.kind, i.expression), i.id]));
  const owned = new Map<string, string>();
  for (const e of entries) {
    const id = e.expression ? byKey.get(keyOf(e.type, e.expression)) : undefined;
    if (id) owned.set(e.id, id);
  }
  return owned;
}

// How many visible entries of each shared group the learner has already (7.4h), by group id.
export async function groupProgress(
  db: UserDb,
  groupEntryIds: readonly string[],
): Promise<Map<string, number>> {
  if (groupEntryIds.length === 0) return new Map();
  const [members, items] = await Promise.all([
    db.libraryGroupMember.findMany({
      where: { groupEntryId: { in: [...groupEntryIds] }, item: VISIBLE_MEMBER },
      select: { groupEntryId: true, item: { select: { type: true, expression: true } } },
    }),
    db.item.findMany({
      where: { kind: { in: [GRAMMAR_KIND, VOCAB_KIND] } },
      select: { kind: true, expression: true },
    }),
  ]);
  return countOwned(
    members.map((m) => ({ groupEntryId: m.groupEntryId, ...m.item })),
    items,
  );
}

// Copies the entries the learner lacks; returns how many were new.
async function copyEntries(db: UserDb, entries: readonly EntryContent[]): Promise<string[]> {
  const owned = await ownedItems(db, entries);
  const missing = entries.filter((e) => !owned.has(e.id) && e.expression && e.meaningVi);
  for (const kind of [GRAMMAR_KIND, VOCAB_KIND]) {
    const ofKind = missing.filter((e) => e.type === kind);
    if (ofKind.length === 0) continue;
    await addItems(
      db,
      ofKind.map((e) => ({
        expression: e.expression!,
        meaningVi: e.meaningVi!,
        reading: e.reading ?? undefined,
        hanviet: e.hanviet ?? undefined,
        level: e.level ?? undefined,
        notes: e.notes ?? undefined,
        libraryEntryId: e.id,
      })),
      LIBRARY_SOURCE,
      kind,
    );
  }
  const taken = missing.map((e) => e.id);
  const now = await ownedItems(db, missing);
  return taken.filter((id) => now.has(id));
}

async function countTakes(db: UserDb, entryIds: readonly string[]): Promise<void> {
  if (entryIds.length === 0) return;
  await db.libraryEntry.updateMany({
    where: { id: { in: [...entryIds] } },
    data: { takeCount: { increment: 1 } },
  });
}

export interface TakeEntryResult {
  itemId: string;
  // The learner had it already (same kind and expression): nothing was copied.
  already: boolean;
}

export async function takeEntry(
  db: UserDb,
  entryId: string,
): Promise<ActionResult<TakeEntryResult>> {
  const entry = await db.libraryEntry.findFirst({
    where: { id: entryId, ...VISIBLE, type: { in: [GRAMMAR_KIND, VOCAB_KIND] } },
    select: CONTENT,
  });
  if (!entry) return err(GONE);
  const had = (await ownedItems(db, [entry])).get(entry.id);
  if (had) return ok({ itemId: had, already: true });
  const taken = await copyEntries(db, [entry]);
  const itemId = (await ownedItems(db, [entry])).get(entry.id);
  if (!itemId) return err('Không lấy được mục này về kho.');
  await countTakes(db, taken);
  return ok({ itemId, already: false });
}

export interface TakeGroupResult {
  groupId: string;
  // Entries copied as new items, and entries the learner had already (still put in the group).
  added: number;
  already: number;
}

// A shared group becomes the learner's own group of the same name, kind and note, holding their copy
// of every entry (rule 8). Taking it again fills the same group with what it lacks.
export async function takeGroup(
  db: UserDb,
  groupEntryId: string,
): Promise<ActionResult<TakeGroupResult>> {
  const group = await db.libraryEntry.findFirst({
    where: { id: groupEntryId, type: GROUP_TYPE, ...VISIBLE },
    select: { id: true, name: true, groupKind: true, notes: true },
  });
  if (!group) return err(GONE);
  const entries = (
    await db.libraryGroupMember.findMany({
      where: { groupEntryId, item: VISIBLE_MEMBER },
      orderBy: { position: 'asc' },
      select: { item: { select: CONTENT } },
    })
  ).map((m) => m.item);

  const taken = await copyEntries(db, entries);
  const owned = await ownedItems(db, entries);

  const mine =
    (await db.group.findFirst({ where: { libraryEntryId: group.id }, select: { id: true } }))?.id ??
    (
      await createGroup(db, {
        name: group.name ?? 'Nhóm từ kho chung',
        kind:
          group.groupKind && isGroupKind(group.groupKind)
            ? (group.groupKind as GroupKind)
            : 'mixed',
        note: group.notes,
        libraryEntryId: group.id,
      })
    ).id;
  await addItemsToGroup(db, mine, [...owned.values()]);
  await countTakes(db, [...taken, group.id]);
  return ok({ groupId: mine, added: taken.length, already: owned.size - taken.length });
}

// Every expression the learner owns, by kind: what "Ẩn mục đã có" leaves out of Kho chung (7.4i).
export async function ownedExpressions(
  db: UserDb,
): Promise<Record<typeof GRAMMAR_KIND | typeof VOCAB_KIND, string[]>> {
  const items = await db.item.findMany({
    where: { kind: { in: [GRAMMAR_KIND, VOCAB_KIND] } },
    select: { kind: true, expression: true },
  });
  const of = (kind: string) => items.filter((i) => i.kind === kind).map((i) => i.expression);
  return { [GRAMMAR_KIND]: of(GRAMMAR_KIND), [VOCAB_KIND]: of(VOCAB_KIND) };
}
