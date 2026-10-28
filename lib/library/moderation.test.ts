import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-library-moderation-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let M: typeof import('@/lib/library/moderation');
let Pub: typeof import('@/lib/library/publish');
let S: typeof import('@/lib/library/shared');
let T: typeof import('@/lib/library/take');
let P: typeof import('@/lib/library/practice');
let G: typeof import('@/lib/library/groups');
let userDb: typeof import('@/lib/db/user-db').userDb;
let author: UserDb;
let curator: UserDb;
let reader: UserDb;

// The author shares 喫茶店; the curator takes it and shares a group holding it and their own 紅茶.
async function setUp() {
  await P.addItems(author, [{ expression: '喫茶店', meaningVi: 'quán cà phê' }], 'MANUAL', 'VOCAB');
  const item = await author.item.findFirstOrThrow({ where: { expression: '喫茶店' } });
  const shared = await Pub.publishItem(author, item.id);
  const entryId = shared.ok ? shared.data.entryId : '';
  const taken = await T.takeEntry(curator, entryId);
  await P.addItems(curator, [{ expression: '紅茶', meaningVi: 'trà đen' }], 'MANUAL', 'VOCAB');
  const tea = await curator.item.findFirstOrThrow({ where: { expression: '紅茶' } });
  const group = await G.createGroup(curator, { name: 'Quán nước', kind: 'vocab' });
  await G.addItemsToGroup(curator, group.id, [taken.ok ? taken.data.itemId : '', tea.id]);
  const res = await Pub.publishGroup(curator, group.id);
  return {
    itemId: item.id,
    entryId,
    groupId: group.id,
    groupEntryId: res.ok ? res.data.entryId : '',
  };
}
const found = async (text: string) =>
  (await S.searchEntries(prisma, { text })).map((e) => e.expression);
const inGroup = async (id: string) =>
  (await S.getGroupEntry(prisma, id))?.entries.map((e) => e.expression) ?? null;

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  M = await import('@/lib/library/moderation');
  Pub = await import('@/lib/library/publish');
  S = await import('@/lib/library/shared');
  T = await import('@/lib/library/take');
  P = await import('@/lib/library/practice');
  G = await import('@/lib/library/groups');
  ({ userDb } = await import('@/lib/db/user-db'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
  await prisma.libraryEntry.deleteMany();
  await prisma.user.deleteMany();
  author = userDb(await createTestUser(prisma, 'author'));
  curator = userDb(await createTestUser(prisma, 'curator'));
  reader = userDb(await createTestUser(prisma, 'reader'));
});

describe('a banned author', () => {
  it('is hidden everywhere while the ban lasts, then comes back', async () => {
    const { entryId, groupEntryId } = await setUp();
    await prisma.user.update({ where: { id: 'author' }, data: { banned: true } });

    expect(await found('喫茶店')).toEqual([]);
    expect(await inGroup(groupEntryId)).toEqual(['紅茶']);
    expect((await T.takeEntry(reader, entryId)).ok).toBe(false);
    const group = await T.takeGroup(reader, groupEntryId);
    expect(group.ok && group.data.added).toBe(1);

    await prisma.user.update({ where: { id: 'author' }, data: { banned: false } });
    expect(await found('喫茶店')).toEqual(['喫茶店']);
    expect(await inGroup(groupEntryId)).toEqual(['喫茶店', '紅茶']);
  });
});

describe('setEntryRemoved', () => {
  it('hides an entry, which its author cannot publish again, and shows it again', async () => {
    const { itemId, entryId } = await setUp();
    expect(await M.setEntryRemoved(prisma, entryId, true)).toEqual({
      ok: true,
      data: { status: 'removed' },
    });
    expect(await found('喫茶店')).toEqual([]);
    await P.updateItem(author, itemId, { meaningVi: 'tiệm cà phê' });
    expect(await Pub.publishItem(author, itemId)).toEqual({
      ok: false,
      error: Pub.REMOVED_BY_ADMIN,
    });
    expect((await Pub.itemShareStatus(author, itemId))?.blocked).toBe(Pub.REMOVED_BY_ADMIN);
    expect((await Pub.unpublishItem(author, itemId)).ok).toBe(false);

    expect((await M.setEntryRemoved(prisma, entryId, false)).ok).toBe(true);
    expect(await found('喫茶店')).toEqual(['喫茶店']);
    expect((await M.setEntryRemoved(prisma, entryId, false)).ok).toBe(false);
  });

  it("leaves an author's own take-down alone", async () => {
    const { itemId, entryId } = await setUp();
    await Pub.unpublishItem(author, itemId);
    expect((await M.setEntryRemoved(prisma, entryId, true)).ok).toBe(false);
    expect((await M.setEntryRemoved(prisma, entryId, false)).ok).toBe(false);
    expect((await prisma.libraryEntry.findUniqueOrThrow({ where: { id: entryId } })).status).toBe(
      'hidden',
    );
  });

  it('keeps a hidden item out of a group share, and a hidden group from coming back', async () => {
    const { groupId, groupEntryId } = await setUp();
    const tea = await prisma.libraryEntry.findFirstOrThrow({ where: { expression: '紅茶' } });
    await M.setEntryRemoved(prisma, tea.id, true);
    expect((await Pub.groupShareStatus(curator, groupId))?.preview.map((p) => p.action)).toEqual([
      'reuse',
      'removed',
    ]);
    expect((await Pub.publishGroup(curator, groupId)).ok).toBe(true);
    expect(await inGroup(groupEntryId)).toEqual(['喫茶店']);

    await M.setEntryRemoved(prisma, groupEntryId, true);
    expect(await S.listGroupEntries(prisma)).toEqual([]);
    expect(await Pub.publishGroup(curator, groupId)).toEqual({
      ok: false,
      error: Pub.GROUP_REMOVED_BY_ADMIN,
    });
    expect((await Pub.groupShareStatus(curator, groupId))?.blocked).toBe(
      Pub.GROUP_REMOVED_BY_ADMIN,
    );
  });
});

describe('a deleted account', () => {
  it("leaves Kho chung but stays inside other learners' groups, with no author", async () => {
    const { entryId, groupEntryId } = await setUp();
    const { deleteAccount } = await import('@/lib/admin/accounts');
    await deleteAccount('author');

    expect(await found('喫茶店')).toEqual([]);
    expect((await T.takeEntry(reader, entryId)).ok).toBe(false);
    expect(await inGroup(groupEntryId)).toEqual(['喫茶店', '紅茶']);
    const entry = await prisma.libraryEntry.findUniqueOrThrow({ where: { id: entryId } });
    expect(entry).toMatchObject({ status: 'orphan', authorId: null, origin: 'LEARNER' });
    const group = await T.takeGroup(reader, groupEntryId);
    expect(group.ok && group.data.added).toBe(2);
    // What the curator took is still theirs.
    expect(await curator.item.count({ where: { expression: '喫茶店' } })).toBe(1);
  });
});

describe('listAuthorEntries', () => {
  it('lists what an account shared, whatever its status', async () => {
    const { itemId } = await setUp();
    await Pub.unpublishItem(author, itemId);
    const rows = await M.listAuthorEntries(prisma, 'author');
    expect(rows.map((r) => [r.expression, r.status])).toEqual([['喫茶店', 'hidden']]);
    expect(
      (await M.listAuthorEntries(prisma, 'curator')).map((r) => r.name ?? r.expression),
    ).toEqual(expect.arrayContaining(['Quán nước', '紅茶']));
  });
});
