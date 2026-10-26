import type { UserDb } from '@/lib/db/user-db';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import { cleanText, cleanTextOrNull } from '@/lib/core/text';
import { groupTextError } from '@/lib/library/group-limits';
import { MAX_LISTED_ITEMS } from '@/lib/library/item-limits';
import type { GroupKind } from '@/lib/library/group-kinds';

export { GROUP_KINDS, isGroupKind, type GroupKind } from '@/lib/library/group-kinds';

const GRAMMAR_ITEM_KIND = GRAMMAR_KIND;
const VOCAB_ITEM_KIND = VOCAB_KIND;

function itemKindFitsGroup(itemKind: string, groupKind: GroupKind): boolean {
  if (groupKind === 'mixed') return true;
  if (groupKind === 'vocab') return itemKind === VOCAB_ITEM_KIND;
  return itemKind === GRAMMAR_ITEM_KIND;
}

export interface GroupSummary {
  id: string;
  name: string;
  kind: GroupKind;
  color: string | null;
  note: string | null;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMemberItem {
  itemId: string;
  expression: string;
  reading: string | null;
  meaningVi: string | null;
  kind: string;
  hanviet?: string | null;
  notes?: string | null;
  level?: string;
  enrichment?: string | null;
  suspended?: boolean;
  starred?: boolean;
  /** When the item entered the library (not the group). */
  createdAt?: Date;
  srs?: {
    state: number;
    due: Date;
    reps: number;
    lapses: number;
    stability?: number;
    difficulty?: number;
  } | null;
}

export interface GroupDetail extends GroupSummary {
  members: GroupMemberItem[];
}

export interface CreateGroupInput {
  name: string;
  kind?: GroupKind;
  color?: string | null;
  note?: string | null;
}

export interface UpdateGroupPatch {
  name?: string;
  kind?: GroupKind;
  color?: string | null;
  note?: string | null;
}

export async function listGroups(db: UserDb): Promise<GroupSummary[]> {
  const rows = await db.group.findMany({
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    kind: g.kind as GroupKind,
    color: g.color,
    note: g.note,
    memberCount: g._count.members,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  }));
}

export async function getGroup(db: UserDb, groupId: string): Promise<GroupDetail | null> {
  const g = await db.group.findFirst({
    where: { id: groupId },
    include: {
      _count: { select: { members: true } },
      members: {
        orderBy: { addedAt: 'desc' },
        include: {
          item: {
            select: {
              id: true,
              expression: true,
              reading: true,
              meaningVi: true,
              kind: true,
              hanviet: true,
              notes: true,
              level: true,
              enrichment: true,
              suspended: true,
              starred: true,
              createdAt: true,
              srs: {
                select: {
                  state: true,
                  due: true,
                  reps: true,
                  lapses: true,
                  stability: true,
                  difficulty: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!g) return null;
  return {
    id: g.id,
    name: g.name,
    kind: g.kind as GroupKind,
    color: g.color,
    note: g.note,
    memberCount: g._count.members,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    members: g.members.map((m) => ({
      itemId: m.item.id,
      expression: m.item.expression,
      reading: m.item.reading,
      meaningVi: m.item.meaningVi,
      kind: m.item.kind,
      hanviet: m.item.hanviet,
      notes: m.item.notes,
      level: m.item.level,
      enrichment: m.item.enrichment,
      suspended: m.item.suspended,
      starred: m.item.starred,
      createdAt: m.item.createdAt,
      srs: m.item.srs,
    })),
  };
}

export async function listAddableItems(
  db: UserDb,
  groupId: string,
): Promise<GroupMemberItem[] | null> {
  const group = await db.group.findFirst({
    where: { id: groupId },
    select: { kind: true },
  });
  if (!group) return null;
  const groupKind = group.kind as GroupKind;
  const kinds =
    groupKind === 'mixed'
      ? [GRAMMAR_ITEM_KIND, VOCAB_ITEM_KIND]
      : groupKind === 'vocab'
        ? [VOCAB_ITEM_KIND]
        : [GRAMMAR_ITEM_KIND];

  const items = await db.item.findMany({
    where: { kind: { in: kinds }, groups: { none: { groupId } } },
    select: {
      id: true,
      expression: true,
      reading: true,
      meaningVi: true,
      kind: true,
      hanviet: true,
      level: true,
      suspended: true,
      starred: true,
      createdAt: true,
      srs: { select: { state: true, due: true, reps: true, lapses: true } },
    },
    orderBy: { expression: 'asc' },
    take: MAX_LISTED_ITEMS,
  });
  return items.map((i) => ({
    itemId: i.id,
    expression: i.expression,
    reading: i.reading,
    meaningVi: i.meaningVi,
    kind: i.kind,
    hanviet: i.hanviet,
    level: i.level,
    suspended: i.suspended,
    starred: i.starred,
    createdAt: i.createdAt,
    srs: i.srs,
  }));
}

export async function getItemGroupPicker(
  db: UserDb,
  itemId: string,
): Promise<{ member: GroupSummary[]; addable: GroupSummary[] } | null> {
  const item = await db.item.findFirst({
    where: { id: itemId },
    select: { kind: true },
  });
  if (!item) return null;
  const itemGroupKind: GroupKind = item.kind === VOCAB_ITEM_KIND ? 'vocab' : 'grammar';

  const [all, memberRows] = await Promise.all([
    listGroups(db),
    db.groupMember.findMany({ where: { itemId }, select: { groupId: true } }),
  ]);
  const memberSet = new Set(memberRows.map((m) => m.groupId));

  return {
    member: all.filter((g) => memberSet.has(g.id)),
    addable: all.filter(
      (g) => !memberSet.has(g.id) && (g.kind === 'mixed' || g.kind === itemGroupKind),
    ),
  };
}

export async function previewGroupMembers(
  db: UserDb,
  kind: GroupKind,
  itemIds: string[],
): Promise<{ fit: GroupMemberItem[]; mismatched: GroupMemberItem[]; notFound: string[] }> {
  const ids = [...new Set(itemIds)];
  if (ids.length === 0) return { fit: [], mismatched: [], notFound: [] };

  const items = await db.item.findMany({
    where: { id: { in: ids } },
    select: { id: true, expression: true, reading: true, meaningVi: true, kind: true },
  });
  const found = new Set(items.map((i) => i.id));
  const notFound = ids.filter((id) => !found.has(id));

  const fit: GroupMemberItem[] = [];
  const mismatched: GroupMemberItem[] = [];
  for (const i of items) {
    const member: GroupMemberItem = {
      itemId: i.id,
      expression: i.expression,
      reading: i.reading,
      meaningVi: i.meaningVi,
      kind: i.kind,
    };
    (itemKindFitsGroup(i.kind, kind) ? fit : mismatched).push(member);
  }
  return { fit, mismatched, notFound };
}

function assertGroupText(name: string | undefined, note: string | null | undefined) {
  const problem = groupTextError('name', name) ?? groupTextError('note', note);
  if (problem) throw new Error(problem);
}

export async function createGroup(db: UserDb, input: CreateGroupInput): Promise<GroupSummary> {
  const name = cleanText(input.name);
  if (!name) throw new Error('Group name is required.');
  assertGroupText(name, input.note);
  const kind: GroupKind = input.kind ?? 'mixed';
  const g = await db.group.create({
    data: {
      name,
      kind,
      color: cleanTextOrNull(input.color ?? null),
      note: cleanTextOrNull(input.note ?? null),
    },
  });
  return {
    id: g.id,
    name: g.name,
    kind: g.kind as GroupKind,
    color: g.color,
    note: g.note,
    memberCount: 0,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

export async function updateGroup(
  db: UserDb,
  groupId: string,
  patch: UpdateGroupPatch,
): Promise<boolean> {
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = cleanText(patch.name);
    if (!name) throw new Error('Group name is required.');
    assertGroupText(name, undefined);
    data.name = name;
  }
  if (patch.note) assertGroupText(undefined, patch.note);
  if (patch.kind !== undefined) data.kind = patch.kind;
  if (patch.color !== undefined) data.color = cleanTextOrNull(patch.color);
  if (patch.note !== undefined) data.note = cleanTextOrNull(patch.note);
  if (Object.keys(data).length === 0) return true;

  const res = await db.group.updateMany({ where: { id: groupId }, data });
  return res.count > 0;
}

export async function deleteGroup(db: UserDb, groupId: string): Promise<boolean> {
  const res = await db.group.deleteMany({ where: { id: groupId } });
  return res.count > 0;
}

export async function addItemsToGroup(
  db: UserDb,
  groupId: string,
  itemIds: string[],
): Promise<{ added: number }> {
  const ids = [...new Set(itemIds)];
  if (ids.length === 0) return { added: 0 };

  const group = await db.group.findFirst({
    where: { id: groupId },
    select: { kind: true },
  });
  if (!group) throw new Error('Group not found.');
  const groupKind = group.kind as GroupKind;

  const items = await db.item.findMany({
    where: { id: { in: ids } },
    select: { id: true, kind: true },
  });
  if (items.length !== ids.length) {
    throw new Error('Some items were not found in your collection.');
  }

  const mismatched = items.filter((i) => !itemKindFitsGroup(i.kind, groupKind));
  if (mismatched.length > 0) {
    throw new Error(
      `Group kind "${groupKind}" does not accept ${mismatched.length} of the selected item(s).`,
    );
  }

  const existing = await db.groupMember.findMany({
    where: { groupId, itemId: { in: items.map((i) => i.id) } },
    select: { itemId: true },
  });
  const alreadyIn = new Set(existing.map((e) => e.itemId));
  const toCreate = items.filter((i) => !alreadyIn.has(i.id));
  if (toCreate.length === 0) return { added: 0 };

  const res = await db.groupMember.createMany({
    data: toCreate.map((i) => ({ groupId, itemId: i.id })),
  });
  return { added: res.count };
}

export async function removeItemsFromGroup(
  db: UserDb,
  groupId: string,
  itemIds: string[],
): Promise<{ removed: number }> {
  const ids = [...new Set(itemIds)];
  if (ids.length === 0) return { removed: 0 };
  const res = await db.groupMember.deleteMany({
    where: { groupId, itemId: { in: ids } },
  });
  return { removed: res.count };
}
