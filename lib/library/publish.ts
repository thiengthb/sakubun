import type { UserDb } from '@/lib/db/user-db';
import { err, ok, type ActionResult } from '@/lib/core/action-result';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import {
  GROUP_TYPE,
  HIDDEN,
  LEARNER_ORIGIN,
  PUBLIC,
  REMOVED,
  type LibraryClient,
} from '@/lib/library/shared';

// Publishing to the shared library (phase 8, L3; plan rules 4 to 8): a learner shares one of their
// own items or groups as a snapshot entry. Only the web calls this; no MCP tool reaches it. Each
// item or group has at most one open share, which publishing again updates.

export { HIDDEN };

// What travels to the shared library. Notes, stars, suspensions and history stay private.
export const SHARED_FIELDS = ['expression', 'reading', 'hanviet', 'meaningVi', 'level'] as const;
export type SharedContent = Record<(typeof SHARED_FIELDS)[number], string | null>;

export const sharedContent = (row: Partial<Record<keyof SharedContent, string | null>>) =>
  Object.fromEntries(SHARED_FIELDS.map((f) => [f, row[f] ?? null])) as SharedContent;

export const sameContent = (a: SharedContent, b: SharedContent) =>
  SHARED_FIELDS.every((f) => (a[f] ?? null) === (b[f] ?? null));

type Shared = SharedContent & { id: string };

export type SharePlan =
  // The learner's own share already says this.
  | { kind: 'unchanged'; entryId: string }
  | { kind: 'update'; entryId: string }
  | { kind: 'create'; basedOnId: string | null }
  // Taken from the shared library and not edited: sharing it again would only make a duplicate.
  | { kind: 'same-as-source'; entryId: string }
  // The admin hid the learner's share (L6): publishing it again would undo that.
  | { kind: 'removed' };

// Pure: what publishing an item does, from the item, the entry it was taken from (if any), the
// learner's open share of it (if any), and whether the admin hid a share of it.
export function planItemShare(
  item: SharedContent,
  source: Shared | null,
  own: Shared | null,
  removed = false,
): SharePlan {
  if (removed) return { kind: 'removed' };
  if (own)
    return sameContent(own, item)
      ? { kind: 'unchanged', entryId: own.id }
      : { kind: 'update', entryId: own.id };
  if (source && sameContent(source, item)) return { kind: 'same-as-source', entryId: source.id };
  return { kind: 'create', basedOnId: source?.id ?? null };
}

export const SAME_AS_SOURCE =
  'Mục này giống hệt bản bạn lấy từ kho chung. Sửa nghĩa, cách đọc hoặc cấp rồi mới công khai được.';
export const REMOVED_BY_ADMIN =
  'Quản trị đã ẩn mục này khỏi Kho chung, nên không công khai lại được.';
const NO_ITEM = 'Không tìm thấy mục này trong kho của bạn.';
const NO_GROUP = 'Không tìm thấy nhóm này trong kho của bạn.';

const ITEM_FIELDS = {
  id: true,
  kind: true,
  expression: true,
  reading: true,
  hanviet: true,
  meaningVi: true,
  level: true,
  libraryEntryId: true,
} as const;
const ENTRY_CONTENT = {
  id: true,
  expression: true,
  reading: true,
  hanviet: true,
  meaningVi: true,
  level: true,
  status: true,
  takeCount: true,
} as const;

type ItemRow = SharedContent & { id: string; kind: string; libraryEntryId: string | null };
// The shared tables and whose shares these are (a transaction client has no $ownerId).
type Author = { db: Pick<LibraryClient, 'libraryEntry'>; me: string };
const author = (db: UserDb): Author => ({ db, me: db.$ownerId() });

// The learner's open shares of these items, the entries they were taken from, and which shares the
// admin hid, by item id.
async function shareContext({ db, me }: Author, items: readonly ItemRow[]) {
  const ids = items.map((i) => i.id);
  const sourceIds = items.flatMap((i) => (i.libraryEntryId ? [i.libraryEntryId] : []));
  const [shares, sources] = await Promise.all([
    db.libraryEntry.findMany({
      where: {
        authorId: me,
        sourceId: { in: ids },
        type: { in: [GRAMMAR_KIND, VOCAB_KIND] },
        status: { in: [PUBLIC, REMOVED] },
      },
      select: { ...ENTRY_CONTENT, sourceId: true },
    }),
    db.libraryEntry.findMany({ where: { id: { in: sourceIds } }, select: ENTRY_CONTENT }),
  ]);
  const ownBy = new Map(shares.filter((e) => e.status === PUBLIC).map((e) => [e.sourceId!, e]));
  const removed = new Set(shares.filter((e) => e.status === REMOVED).map((e) => e.sourceId!));
  const sourceBy = new Map(sources.map((e) => [e.id, e]));
  return (item: ItemRow) => ({
    own: ownBy.get(item.id) ?? null,
    source: item.libraryEntryId ? (sourceBy.get(item.libraryEntryId) ?? null) : null,
    removed: removed.has(item.id),
  });
}
const planFor = (item: ItemRow, ctx: ReturnType<Awaited<ReturnType<typeof shareContext>>>) =>
  planItemShare(item, ctx.source, ctx.own, ctx.removed);

// Carries out a plan; returns the entry that now shares the item.
async function applyPlan(
  { db, me }: Author,
  item: ItemRow,
  plan: Exclude<SharePlan, { kind: 'removed' }>,
): Promise<string> {
  const content = sharedContent(item);
  if (plan.kind === 'update') {
    await db.libraryEntry.update({ where: { id: plan.entryId }, data: content });
    return plan.entryId;
  }
  if (plan.kind === 'create') {
    const created = await db.libraryEntry.create({
      data: {
        ...content,
        type: item.kind,
        origin: LEARNER_ORIGIN,
        authorId: me,
        sourceId: item.id,
        basedOnId: plan.basedOnId,
      },
      select: { id: true },
    });
    return created.id;
  }
  return plan.entryId;
}

export interface ItemShareStatus {
  // The learner's open share, if any, and whether the item has changed since.
  shared: { entryId: string; takeCount: number; changed: boolean } | null;
  // Taken from the shared library: the entry it came from, when it still exists.
  basedOn: { entryId: string; status: string } | null;
  // Why "Công khai" is refused now, if it is.
  blocked: string | null;
}

export async function itemShareStatus(db: UserDb, itemId: string): Promise<ItemShareStatus | null> {
  const item = await db.item.findFirst({ where: { id: itemId }, select: ITEM_FIELDS });
  if (!item) return null;
  const ctx = (await shareContext(author(db), [item]))(item);
  const { own, source } = ctx;
  const plan = planFor(item, ctx);
  return {
    shared: own
      ? { entryId: own.id, takeCount: own.takeCount, changed: plan.kind === 'update' }
      : null,
    basedOn: source ? { entryId: source.id, status: source.status } : null,
    blocked:
      plan.kind === 'same-as-source'
        ? SAME_AS_SOURCE
        : plan.kind === 'removed'
          ? REMOVED_BY_ADMIN
          : null,
  };
}

export interface PublishResult {
  entryId: string;
  // A new share (false: the open one was updated, or already said this).
  created: boolean;
}

// Rules 4 and 5: shares the item, or updates its open share; refuses an unedited copy.
export async function publishItem(
  db: UserDb,
  itemId: string,
): Promise<ActionResult<PublishResult>> {
  const item = await db.item.findFirst({ where: { id: itemId }, select: ITEM_FIELDS });
  if (!item) return err(NO_ITEM);
  const plan = planFor(item, (await shareContext(author(db), [item]))(item));
  if (plan.kind === 'same-as-source') return err(SAME_AS_SOURCE);
  if (plan.kind === 'removed') return err(REMOVED_BY_ADMIN);
  return ok({ entryId: await applyPlan(author(db), item, plan), created: plan.kind === 'create' });
}

// Rule 6: the share leaves the shared library; whoever took it keeps their copy.
export async function unpublishItem(
  db: UserDb,
  itemId: string,
): Promise<ActionResult<{ hidden: number }>> {
  const res = await db.libraryEntry.updateMany({
    where: {
      authorId: db.$ownerId(),
      sourceId: itemId,
      type: { in: [GRAMMAR_KIND, VOCAB_KIND] },
      status: PUBLIC,
    },
    data: { status: HIDDEN },
  });
  return res.count > 0 ? ok({ hidden: res.count }) : err('Mục này chưa được công khai.');
}

const groupItems = (db: UserDb, groupId: string) =>
  db.group.findFirst({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      kind: true,
      note: true,
      members: { orderBy: { addedAt: 'asc' }, select: { item: { select: ITEM_FIELDS } } },
    },
  });

export interface GroupShareStatus {
  shared: { entryId: string; takeCount: number } | null;
  // What publishing would put on the shared library, in order: the learner sees it before agreeing.
  // An item the admin hid is left out of the group ('removed').
  preview: {
    itemId: string;
    expression: string;
    action: 'new' | 'update' | 'reuse' | 'same' | 'removed';
  }[];
  // Why "Công khai" is refused now, if it is.
  blocked: string | null;
}

const PREVIEW_ACTION = {
  create: 'new',
  update: 'update',
  'same-as-source': 'reuse',
  unchanged: 'same',
  removed: 'removed',
} as const;

export const GROUP_REMOVED_BY_ADMIN =
  'Quản trị đã ẩn nhóm này khỏi Kho chung, nên không công khai lại được.';

export async function groupShareStatus(
  db: UserDb,
  groupId: string,
): Promise<GroupShareStatus | null> {
  const group = await groupItems(db, groupId);
  if (!group) return null;
  const items = group.members.map((m) => m.item);
  const [context, own, removed] = await Promise.all([
    shareContext(author(db), items),
    ownGroupShare(author(db), groupId),
    groupRemoved(author(db), groupId),
  ]);
  return {
    shared: own ? { entryId: own.id, takeCount: own.takeCount } : null,
    preview: items.map((item) => ({
      itemId: item.id,
      expression: item.expression ?? '',
      action: PREVIEW_ACTION[planFor(item, context(item)).kind],
    })),
    blocked: removed ? GROUP_REMOVED_BY_ADMIN : null,
  };
}

const groupRemoved = async ({ db, me }: Author, groupId: string) =>
  (await db.libraryEntry.count({
    where: { authorId: me, sourceId: groupId, type: GROUP_TYPE, status: REMOVED },
  })) > 0;

const ownGroupShare = ({ db, me }: Author, groupId: string) =>
  db.libraryEntry.findFirst({
    where: { authorId: me, sourceId: groupId, type: GROUP_TYPE, status: PUBLIC },
    select: { id: true, takeCount: true },
  });

// Rule 8: a group is shared with every item in it. An item the learner wrote (or edited after
// taking it) is shared as their own entry; one taken and left as it was points to the entry it
// came from, so nothing is duplicated. Only the group's items go out, never the rest of the library.
export async function publishGroup(
  db: UserDb,
  groupId: string,
): Promise<ActionResult<PublishResult & { items: number }>> {
  const group = await groupItems(db, groupId);
  if (!group) return err(NO_GROUP);
  const items = group.members.map((m) => m.item);
  if (items.length === 0) return err('Nhóm còn trống. Thêm mục vào nhóm rồi mới công khai được.');
  if (await groupRemoved(author(db), groupId)) return err(GROUP_REMOVED_BY_ADMIN);
  const before = await shareContext(author(db), items);
  if (items.every((item) => planFor(item, before(item)).kind === 'removed'))
    return err('Quản trị đã ẩn mọi mục trong nhóm này, nên không còn gì để công khai.');

  const me = db.$ownerId();
  return db.$transaction(async (tx) => {
    const as: Author = { db: tx, me };
    const context = await shareContext(as, items);
    const entryIds: string[] = [];
    for (const item of items) {
      const plan = planFor(item, context(item));
      // An item the admin hid stays out of the group.
      if (plan.kind !== 'removed') entryIds.push(await applyPlan(as, item, plan));
    }
    const content = { name: group.name, groupKind: group.kind, notes: group.note };
    const own = await ownGroupShare(as, groupId);
    const entryId = own
      ? (
          await tx.libraryEntry.update({
            where: { id: own.id },
            data: content,
            select: { id: true },
          })
        ).id
      : (
          await tx.libraryEntry.create({
            data: {
              ...content,
              type: GROUP_TYPE,
              origin: LEARNER_ORIGIN,
              authorId: me,
              sourceId: groupId,
            },
            select: { id: true },
          })
        ).id;
    await tx.libraryGroupMember.deleteMany({ where: { groupEntryId: entryId } });
    await tx.libraryGroupMember.createMany({
      data: [...new Set(entryIds)].map((itemEntryId, position) => ({
        groupEntryId: entryId,
        itemEntryId,
        position,
      })),
    });
    return ok({ entryId, created: !own, items: entryIds.length });
  });
}

// The group leaves the shared library. Its items stay shared on their own: each is unpublished from
// its own page, so taking a group down never pulls entries out of other people's groups.
export async function unpublishGroup(
  db: UserDb,
  groupId: string,
): Promise<ActionResult<{ hidden: number }>> {
  const res = await db.libraryEntry.updateMany({
    where: { authorId: db.$ownerId(), sourceId: groupId, type: GROUP_TYPE, status: PUBLIC },
    data: { status: HIDDEN },
  });
  return res.count > 0 ? ok({ hidden: res.count }) : err('Nhóm này chưa được công khai.');
}
