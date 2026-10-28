import type { UserDb } from '@/lib/db/user-db';
import { err, ok, type ActionResult } from '@/lib/core/action-result';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import { GROUP_TYPE, LEARNER_ORIGIN, PUBLIC, type LibraryClient } from '@/lib/library/shared';

// Publishing to the shared library (phase 8, L3; plan rules 4 to 8): a learner shares one of their
// own items or groups as a snapshot entry. Only the web calls this; no MCP tool reaches it. Each
// item or group has at most one open share, which publishing again updates.

export const HIDDEN = 'hidden';

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
  | { kind: 'same-as-source'; entryId: string };

// Pure: what publishing an item does, from the item, the entry it was taken from (if any) and the
// learner's open share of it (if any).
export function planItemShare(
  item: SharedContent,
  source: Shared | null,
  own: Shared | null,
): SharePlan {
  if (own)
    return sameContent(own, item)
      ? { kind: 'unchanged', entryId: own.id }
      : { kind: 'update', entryId: own.id };
  if (source && sameContent(source, item)) return { kind: 'same-as-source', entryId: source.id };
  return { kind: 'create', basedOnId: source?.id ?? null };
}

export const SAME_AS_SOURCE =
  'Mục này giống hệt bản bạn lấy từ kho chung. Sửa nghĩa, cách đọc hoặc cấp rồi mới công khai được.';
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

// The learner's open shares of these items, and the entries they were taken from, by item id.
async function shareContext({ db, me }: Author, items: readonly ItemRow[]) {
  const ids = items.map((i) => i.id);
  const sourceIds = items.flatMap((i) => (i.libraryEntryId ? [i.libraryEntryId] : []));
  const [own, sources] = await Promise.all([
    db.libraryEntry.findMany({
      where: {
        authorId: me,
        sourceId: { in: ids },
        type: { in: [GRAMMAR_KIND, VOCAB_KIND] },
        status: PUBLIC,
      },
      select: { ...ENTRY_CONTENT, sourceId: true },
    }),
    db.libraryEntry.findMany({ where: { id: { in: sourceIds } }, select: ENTRY_CONTENT }),
  ]);
  const ownBy = new Map(own.map((e) => [e.sourceId!, e]));
  const sourceBy = new Map(sources.map((e) => [e.id, e]));
  return (item: ItemRow) => ({
    own: ownBy.get(item.id) ?? null,
    source: item.libraryEntryId ? (sourceBy.get(item.libraryEntryId) ?? null) : null,
  });
}

// Carries out a plan; returns the entry that now shares the item.
async function applyPlan({ db, me }: Author, item: ItemRow, plan: SharePlan): Promise<string> {
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
  const { own, source } = (await shareContext(author(db), [item]))(item);
  const plan = planItemShare(item, source, own);
  return {
    shared: own
      ? { entryId: own.id, takeCount: own.takeCount, changed: plan.kind === 'update' }
      : null,
    basedOn: source ? { entryId: source.id, status: source.status } : null,
    blocked: plan.kind === 'same-as-source' ? SAME_AS_SOURCE : null,
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
  const { own, source } = (await shareContext(author(db), [item]))(item);
  const plan = planItemShare(item, source, own);
  if (plan.kind === 'same-as-source') return err(SAME_AS_SOURCE);
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
  preview: { itemId: string; expression: string; action: 'new' | 'update' | 'reuse' | 'same' }[];
}

const PREVIEW_ACTION = {
  create: 'new',
  update: 'update',
  'same-as-source': 'reuse',
  unchanged: 'same',
} as const;

export async function groupShareStatus(
  db: UserDb,
  groupId: string,
): Promise<GroupShareStatus | null> {
  const group = await groupItems(db, groupId);
  if (!group) return null;
  const items = group.members.map((m) => m.item);
  const [context, own] = await Promise.all([
    shareContext(author(db), items),
    ownGroupShare(author(db), groupId),
  ]);
  return {
    shared: own ? { entryId: own.id, takeCount: own.takeCount } : null,
    preview: items.map((item) => {
      const { own, source } = context(item);
      return {
        itemId: item.id,
        expression: item.expression ?? '',
        action: PREVIEW_ACTION[planItemShare(item, source, own).kind],
      };
    }),
  };
}

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

  const me = db.$ownerId();
  return db.$transaction(async (tx) => {
    const as: Author = { db: tx, me };
    const context = await shareContext(as, items);
    const entryIds: string[] = [];
    for (const item of items) {
      const { own, source } = context(item);
      entryIds.push(await applyPlan(as, item, planItemShare(item, source, own)));
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
