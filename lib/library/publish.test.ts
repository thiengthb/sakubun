import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';
import type { StarterItem } from '@/lib/import/starter-deck';

createTestDb('sakubun-library-publish-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let Pub: typeof import('@/lib/library/publish');
let T: typeof import('@/lib/library/take');
let S: typeof import('@/lib/library/shared');
let P: typeof import('@/lib/library/practice');
let G: typeof import('@/lib/library/groups');
let mine: UserDb;
let other: UserDb;

const DECK: StarterItem[] = ['店', '静か'].map((expression) => ({
  id: `VOCAB-${expression}`,
  kind: 'VOCAB',
  expression,
  reading: 'よみ',
  hanviet: null,
  meaningVi: expression === '店' ? 'cửa hàng' : 'yên tĩnh',
  level: 'N5',
  notes: '',
  tags: '[]',
  source: 'OPENJLPT',
  suspended: false,
  starred: false,
}));

const openJlpt = (expression: string) =>
  prisma.libraryEntry.findFirstOrThrow({ where: { expression, origin: 'OPENJLPT' } });

async function own(expression: string, meaningVi: string, notes?: string) {
  await P.addItems(mine, [{ expression, meaningVi, notes }], 'MANUAL', 'VOCAB');
  return (await mine.item.findFirstOrThrow({ where: { expression } })).id;
}
async function taken(expression: string) {
  const res = await T.takeEntry(mine, (await openJlpt(expression)).id);
  if (!res.ok) throw new Error(res.error);
  return res.data.itemId;
}
const shares = () =>
  prisma.libraryEntry.findMany({ where: { origin: 'LEARNER' }, orderBy: { createdAt: 'asc' } });

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  Pub = await import('@/lib/library/publish');
  T = await import('@/lib/library/take');
  S = await import('@/lib/library/shared');
  P = await import('@/lib/library/practice');
  G = await import('@/lib/library/groups');
  const { userDb } = await import('@/lib/db/user-db');
  mine = userDb(await createTestUser(prisma, 'author'));
  other = userDb(await createTestUser(prisma, 'other'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
  await prisma.libraryEntry.deleteMany();
  await S.seedOpenJlpt(prisma, DECK);
});

describe('planItemShare', () => {
  // Pub loads in beforeAll, so the fixtures are built per test.
  const content = () => Pub.sharedContent({ expression: '店', meaningVi: 'tiệm', level: 'N5' });
  const entry = (meaningVi: string) => ({ ...content(), meaningVi, id: 'e' });

  it('creates a share for an item of its own, based on nothing', () => {
    expect(Pub.planItemShare(content(), null, null)).toEqual({ kind: 'create', basedOnId: null });
  });
  it('refuses an unedited copy and bases an edited one on its source', () => {
    expect(Pub.planItemShare(content(), entry('tiệm'), null).kind).toBe('same-as-source');
    expect(Pub.planItemShare(content(), entry('cửa hàng'), null)).toEqual({
      kind: 'create',
      basedOnId: 'e',
    });
  });
  it('updates the open share only when the item changed', () => {
    expect(Pub.planItemShare(content(), null, entry('tiệm')).kind).toBe('unchanged');
    expect(Pub.planItemShare(content(), null, entry('cũ')).kind).toBe('update');
  });
});

describe('publishItem', () => {
  it('shares an item of its own as a public entry, without its notes', async () => {
    const id = await own('喫茶店', 'quán cà phê', 'ghi chú riêng của tôi');
    const res = await Pub.publishItem(mine, id);
    expect(res).toEqual({ ok: true, data: { entryId: expect.any(String), created: true } });
    const [entry] = await shares();
    expect(entry).toMatchObject({
      type: 'VOCAB',
      expression: '喫茶店',
      meaningVi: 'quán cà phê',
      notes: null,
      authorId: 'author',
      sourceId: id,
      basedOnId: null,
      status: 'public',
    });
    expect((await S.searchEntries(prisma, { text: '喫茶店' })).map((e) => e.id)).toEqual([
      entry.id,
    ]);
  });

  it('keeps one open share per item, updated when the item changes', async () => {
    const id = await own('喫茶店', 'quán cà phê');
    const first = await Pub.publishItem(mine, id);
    expect((await Pub.publishItem(mine, id)).ok && first.ok).toBe(true);
    await P.updateItem(mine, id, { meaningVi: 'tiệm cà phê' });
    expect((await Pub.itemShareStatus(mine, id))?.shared?.changed).toBe(true);
    const again = await Pub.publishItem(mine, id);
    expect(again.ok && again.data).toEqual({
      entryId: first.ok && first.data.entryId,
      created: false,
    });
    expect((await shares()).map((e) => e.meaningVi)).toEqual(['tiệm cà phê']);
    expect((await Pub.itemShareStatus(mine, id))?.shared?.changed).toBe(false);
  });

  it('refuses a copy taken and not edited, and shares an edited one as based on its source', async () => {
    const id = await taken('店');
    expect(await Pub.publishItem(mine, id)).toEqual({ ok: false, error: Pub.SAME_AS_SOURCE });
    expect((await Pub.itemShareStatus(mine, id))?.blocked).toBe(Pub.SAME_AS_SOURCE);
    // Notes are not shared, so editing them alone changes nothing.
    await P.updateItem(mine, id, { notes: 'của tôi' });
    expect((await Pub.publishItem(mine, id)).ok).toBe(false);

    await P.updateItem(mine, id, { meaningVi: 'cửa tiệm, quán' });
    const res = await Pub.publishItem(mine, id);
    expect(res.ok).toBe(true);
    const [entry] = await shares();
    expect(entry).toMatchObject({
      basedOnId: (await openJlpt('店')).id,
      meaningVi: 'cửa tiệm, quán',
    });
  });

  it('takes a share down; whoever took it keeps their copy', async () => {
    const id = await own('喫茶店', 'quán cà phê');
    const res = await Pub.publishItem(mine, id);
    const entryId = res.ok ? res.data.entryId : '';
    expect((await T.takeEntry(other, entryId)).ok).toBe(true);

    expect((await Pub.unpublishItem(mine, id)).ok).toBe(true);
    expect((await shares())[0].status).toBe(Pub.HIDDEN);
    expect(await S.searchEntries(prisma, { text: '喫茶店' })).toEqual([]);
    expect(await other.item.count({ where: { expression: '喫茶店' } })).toBe(1);
    expect((await Pub.unpublishItem(mine, id)).ok).toBe(false);
    // Publishing again opens a new share.
    expect((await Pub.publishItem(mine, id)).ok && (await shares()).length).toBe(2);
  });

  it("never touches another learner's item or share", async () => {
    const id = await own('喫茶店', 'quán cà phê');
    expect((await Pub.publishItem(other, id)).ok).toBe(false);
    await Pub.publishItem(mine, id);
    expect((await Pub.unpublishItem(other, id)).ok).toBe(false);
    expect((await shares())[0].status).toBe('public');
  });
});

describe('publishGroup', () => {
  async function group(itemIds: string[]) {
    const g = await G.createGroup(mine, { name: 'Đi cà phê', kind: 'vocab', note: 'Từ ở quán' });
    await G.addItemsToGroup(mine, g.id, itemIds);
    return g.id;
  }

  it('shares the group with its items, pointing unedited copies to their source', async () => {
    const written = await own('喫茶店', 'quán cà phê');
    const copy = await taken('店');
    const edited = await taken('静か');
    await P.updateItem(mine, edited, { meaningVi: 'yên ắng' });
    await own('秘密', 'bí mật, không có trong nhóm');
    const groupId = await group([written, copy, edited]);

    expect((await Pub.groupShareStatus(mine, groupId))?.preview.map((p) => p.action)).toEqual([
      'new',
      'reuse',
      'new',
    ]);
    const res = await Pub.publishGroup(mine, groupId);
    expect(res).toEqual({
      ok: true,
      data: { entryId: expect.any(String), created: true, items: 3 },
    });
    const shared = await S.getGroupEntry(prisma, res.ok ? res.data.entryId : '');
    expect(shared).toMatchObject({ name: 'Đi cà phê', groupKind: 'vocab', notes: 'Từ ở quán' });
    expect(shared?.entries.map((e) => [e.expression, e.origin])).toEqual([
      ['喫茶店', 'LEARNER'],
      ['店', 'OPENJLPT'],
      ['静か', 'LEARNER'],
    ]);
    expect(shared?.entries[2].basedOnId).toBe((await openJlpt('静か')).id);
    // Only the group's items went out.
    expect((await shares()).map((e) => e.expression ?? e.name).sort()).toEqual(
      ['喫茶店', '静か', 'Đi cà phê'].sort(),
    );
  });

  it('updates the same share when published again', async () => {
    const a = await own('喫茶店', 'quán cà phê');
    const b = await own('紅茶', 'trà đen');
    const groupId = await group([a, b]);
    const first = await Pub.publishGroup(mine, groupId);
    await G.removeItemsFromGroup(mine, groupId, [b]);
    await G.updateGroup(mine, groupId, { name: 'Quán cà phê' });
    const again = await Pub.publishGroup(mine, groupId);
    expect(again.ok && first.ok && again.data.entryId).toBe(first.ok && first.data.entryId);
    const shared = await S.getGroupEntry(prisma, again.ok ? again.data.entryId : '');
    expect(shared?.name).toBe('Quán cà phê');
    expect(shared?.entries.map((e) => e.expression)).toEqual(['喫茶店']);
    expect((await Pub.groupShareStatus(mine, groupId))?.preview.map((p) => p.action)).toEqual([
      'same',
    ]);
  });

  it('refuses an empty group, and taking a group down leaves its items shared', async () => {
    const empty = await group([]);
    expect((await Pub.publishGroup(mine, empty)).ok).toBe(false);

    const a = await own('喫茶店', 'quán cà phê');
    const groupId = await group([a]);
    await Pub.publishGroup(mine, groupId);
    expect((await Pub.unpublishGroup(other, groupId)).ok).toBe(false);
    expect((await Pub.unpublishGroup(mine, groupId)).ok).toBe(true);
    expect(await S.listGroupEntries(prisma).then((gs) => gs.map((g) => g.name))).not.toContain(
      'Đi cà phê',
    );
    expect((await S.searchEntries(prisma, { text: '喫茶店' })).length).toBe(1);
  });
});

describe('likes', () => {
  it('counts one like per learner and ranks the liked share first among equals', async () => {
    const L = await import('@/lib/library/likes');
    const a = await own('喫茶店', 'quán cà phê');
    const first = await Pub.publishItem(mine, a);
    await P.addItems(other, [{ expression: '喫茶店', meaningVi: 'tiệm nước' }], 'MANUAL', 'VOCAB');
    const theirs = await other.item.findFirstOrThrow({ where: { expression: '喫茶店' } });
    const second = await Pub.publishItem(other, theirs.id);
    const liked = second.ok ? second.data.entryId : '';

    expect(await L.setLike(mine, liked, true)).toEqual({
      ok: true,
      data: { liked: true, likes: 1 },
    });
    expect((await L.setLike(mine, liked, true)).ok).toBe(true);
    expect((await L.setLike(other, liked, true)).ok && (await prisma.libraryLike.count())).toBe(2);
    expect([...(await L.likedEntries(mine, [liked, first.ok ? first.data.entryId : '']))]).toEqual([
      liked,
    ]);
    const found = await S.searchEntries(prisma, { text: '喫茶店' });
    expect(found.map((e) => [e.id, e._count.likes])).toEqual([
      [liked, 2],
      [first.ok && first.data.entryId, 0],
    ]);

    expect(await L.setLike(other, liked, false)).toEqual({
      ok: true,
      data: { liked: false, likes: 1 },
    });
    await Pub.unpublishItem(other, theirs.id);
    expect((await L.setLike(mine, liked, true)).ok).toBe(false);
  });
});
