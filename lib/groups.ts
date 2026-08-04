// Study groups — named collections of Items (vocab/grammar) that scope focused practice. The ONLY
// DB layer for group CRUD + membership; the UI Server Actions and the MCP tools both call these, so
// behavior stays identical across surfaces (same contract as lib/practice.ts). Groups are purely an
// organization + practice-scoping layer — they NEVER touch FSRS. Plan docs/plans/2026-07-21-study-groups.md.

import { prisma } from '@/lib/db';
import { cleanText, cleanTextOrNull } from '@/lib/text';
import type { GroupKind } from '@/lib/group-kinds';

// Re-export the client-safe kind enum/type so server callers can import everything from lib/groups.
export { GROUP_KINDS, isGroupKind, type GroupKind } from '@/lib/group-kinds';

// Item.kind is stored uppercase ('GRAMMAR' | 'VOCAB'); Group.kind is a lowercase soft constraint on
// which item kinds may join. `mixed` accepts both. SQLite/Prisma can't enforce this — we do, here.
const GRAMMAR_ITEM_KIND = 'GRAMMAR';
const VOCAB_ITEM_KIND = 'VOCAB';

/** Does an Item of `itemKind` belong in a group of `groupKind`? `mixed` takes anything. */
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
  // Optional richer fields — populated only by getGroup (feeds the flashcard back face + the enrich
  // dialog); the add picker (listAddableItems) leaves them undefined since it only renders
  // expression/reading/meaning.
  hanviet?: string | null;
  notes?: string | null;
  level?: string;
  enrichment?: string | null;
  suspended?: boolean;
  srs?: { state: number; due: Date; reps: number; lapses: number } | null;
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

// ---------------- read ----------------

/** All of a user's groups, newest first, each with its member count. */
export async function listGroups(): Promise<GroupSummary[]> {
  const rows = await prisma.group.findMany({
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

/** One group with its member items, or null if there is no such group. */
export async function getGroup(groupId: string): Promise<GroupDetail | null> {
  const g = await prisma.group.findFirst({
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
              srs: { select: { state: true, due: true, reps: true, lapses: true } },
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
      srs: m.item.srs,
    })),
  };
}

/**
 * Items the user could still add to this group: their own items whose kind fits the group's kind and
 * that aren't already members (`groups: { none }`). Returns null if there is no such group. Feeds
 * the "add items" picker on the group detail page.
 */
export async function listAddableItems(groupId: string): Promise<GroupMemberItem[] | null> {
  const group = await prisma.group.findFirst({
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

  const items = await prisma.item.findMany({
    where: { kind: { in: kinds }, groups: { none: { groupId } } },
    select: { id: true, expression: true, reading: true, meaningVi: true, kind: true },
    orderBy: { expression: 'asc' },
    take: 500,
  });
  return items.map((i) => ({
    itemId: i.id,
    expression: i.expression,
    reading: i.reading,
    meaningVi: i.meaningVi,
    kind: i.kind,
  }));
}

/**
 * For the item-detail page: the groups this item is IN (removable chips) + the groups it could still
 * be ADDED to (compatible kind, not already a member). Returns null if there is no such item.
 */
export async function getItemGroupPicker(itemId: string): Promise<{ member: GroupSummary[]; addable: GroupSummary[] } | null> {
  const item = await prisma.item.findFirst({
    where: { id: itemId },
    select: { kind: true },
  });
  if (!item) return null;
  const itemGroupKind: GroupKind = item.kind === VOCAB_ITEM_KIND ? 'vocab' : 'grammar';

  const [all, memberRows] = await Promise.all([
    listGroups(),
    prisma.groupMember.findMany({ where: { itemId }, select: { groupId: true } }),
  ]);
  const memberSet = new Set(memberRows.map((m) => m.groupId));

  return {
    member: all.filter((g) => memberSet.has(g.id)),
    addable: all.filter(
      (g) => !memberSet.has(g.id) && (g.kind === 'mixed' || g.kind === itemGroupKind),
    ),
  };
}

/**
 * DRY-RUN a proposed grouping (writes nothing) so Claude can show the learner an accurate preview
 * before they approve: which of `itemIds` would join a `kind` group, which are rejected by the
 * kind-guard, and which aren't the user's. Mirrors the split used by add_vocab/enrich_items —
 * Claude does the intelligent selection (it sees the chat + library), the server verifies. Only on
 * the learner's yes does Claude call createGroup + addItemsToGroup. Duplicate ids are collapsed.
 */
export async function previewGroupMembers(
  kind: GroupKind,
  itemIds: string[],
): Promise<{ fit: GroupMemberItem[]; mismatched: GroupMemberItem[]; notFound: string[] }> {
  const ids = [...new Set(itemIds)];
  if (ids.length === 0) return { fit: [], mismatched: [], notFound: [] };

  const items = await prisma.item.findMany({
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

// ---------------- write ----------------

/** Create a group. `name` is required; kind defaults to 'mixed'. */
export async function createGroup(input: CreateGroupInput): Promise<GroupSummary> {
  const name = cleanText(input.name);
  if (!name) throw new Error('Group name is required.');
  const kind: GroupKind = input.kind ?? 'mixed';
  const g = await prisma.group.create({
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

/**
 * Update a group's name/kind/color/note. Returns false if there is no such group.
 * NOTE: narrowing kind (e.g. mixed → vocab) does NOT evict now-mismatched members — the caller decides;
 * a future member would still be kind-guarded on add.
 */
export async function updateGroup(
  groupId: string,
  patch: UpdateGroupPatch,
): Promise<boolean> {
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = cleanText(patch.name);
    if (!name) throw new Error('Group name is required.');
    data.name = name;
  }
  if (patch.kind !== undefined) data.kind = patch.kind;
  if (patch.color !== undefined) data.color = cleanTextOrNull(patch.color);
  if (patch.note !== undefined) data.note = cleanTextOrNull(patch.note);
  if (Object.keys(data).length === 0) return true;

  const res = await prisma.group.updateMany({ where: { id: groupId }, data });
  return res.count > 0;
}

/** Delete a group (cascade drops its GroupMember rows). Returns false if there is no such group. */
export async function deleteGroup(groupId: string): Promise<boolean> {
  const res = await prisma.group.deleteMany({ where: { id: groupId } });
  return res.count > 0;
}

/**
 * Add items to a group (idempotent — re-adding an existing member is a no-op). Enforces the kind-guard:
 * every item must fit the group's kind. Throws if the group or any item does not exist, or if any
 * item's kind does not fit. Returns how many NEW memberships were created.
 */
export async function addItemsToGroup(
  groupId: string,
  itemIds: string[],
): Promise<{ added: number }> {
  const ids = [...new Set(itemIds)];
  if (ids.length === 0) return { added: 0 };

  const group = await prisma.group.findFirst({
    where: { id: groupId },
    select: { kind: true },
  });
  if (!group) throw new Error('Group not found.');
  const groupKind = group.kind as GroupKind;

  // Missing ids mean the item does not exist.
  const items = await prisma.item.findMany({
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

  // Idempotency by hand: SQLite's createMany has no `skipDuplicates`, so drop items already in the
  // group first, then insert only the new ones (this also yields an accurate `added` count).
  const existing = await prisma.groupMember.findMany({
    where: { groupId, itemId: { in: items.map((i) => i.id) } },
    select: { itemId: true },
  });
  const alreadyIn = new Set(existing.map((e) => e.itemId));
  const toCreate = items.filter((i) => !alreadyIn.has(i.id));
  if (toCreate.length === 0) return { added: 0 };

  const res = await prisma.groupMember.createMany({
    data: toCreate.map((i) => ({ groupId, itemId: i.id })),
  });
  return { added: res.count };
}

/** Remove items from a group. Returns how many memberships were removed. */
export async function removeItemsFromGroup(
  groupId: string,
  itemIds: string[],
): Promise<{ removed: number }> {
  const ids = [...new Set(itemIds)];
  if (ids.length === 0) return { removed: 0 };
  const res = await prisma.groupMember.deleteMany({
    where: { groupId, itemId: { in: ids } },
  });
  return { removed: res.count };
}
