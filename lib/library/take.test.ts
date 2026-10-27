import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';
import type { StarterItem } from '@/lib/import/starter-deck';

createTestDb('sakubun-library-take-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let T: typeof import('@/lib/library/take');
let S: typeof import('@/lib/library/shared');
let mine: UserDb;
let other: UserDb;

const item = (kind: string, expression: string, meaningVi: string): StarterItem => ({
  id: `${kind}-${expression}`,
  kind,
  expression,
  reading: kind === 'VOCAB' ? 'よみ' : null,
  hanviet: null,
  meaningVi,
  level: 'N5',
  notes: 'Ví dụ: 店に行きます。',
  tags: '[]',
  source: 'OPENJLPT',
  suspended: false,
  starred: false,
});

const DECK = [
  item('VOCAB', '店', 'cửa hàng'),
  item('VOCAB', '静か', 'yên tĩnh'),
  item('VOCAB', '切符', 'vé'),
];

async function entry(expression: string) {
  return prisma.libraryEntry.findFirstOrThrow({ where: { expression, origin: 'OPENJLPT' } });
}
async function vocabGroup() {
  return prisma.libraryEntry.findFirstOrThrow({ where: { type: 'GROUP', name: 'N5 · Từ vựng' } });
}

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  T = await import('@/lib/library/take');
  S = await import('@/lib/library/shared');
  const { userDb } = await import('@/lib/db/user-db');
  mine = userDb(await createTestUser(prisma, 'learner'));
  other = userDb(await createTestUser(prisma, 'other'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
  await prisma.libraryEntry.deleteMany();
  await S.seedOpenJlpt(prisma, DECK);
});

describe('takeEntry', () => {
  it('copies the entry into a new item with a fresh schedule, linked back, and counts the take', async () => {
    const shop = await entry('店');
    const taken = await T.takeEntry(mine, shop.id);
    expect(taken).toEqual({ ok: true, data: { itemId: expect.any(String), already: false } });
    const copy = await mine.item.findFirstOrThrow({
      where: { expression: '店' },
      include: { srs: true },
    });
    expect(copy).toMatchObject({
      kind: 'VOCAB',
      meaningVi: 'cửa hàng',
      reading: 'よみ',
      source: 'LIBRARY',
      libraryEntryId: shop.id,
      starred: false,
    });
    expect(copy.srs?.reps).toBe(0);
    expect((await entry('店')).takeCount).toBe(1);
  });

  it('says the learner has it already and copies nothing, however they came by it', async () => {
    const P = await import('@/lib/library/practice');
    await P.addItems(mine, [{ expression: '店', meaningVi: 'tiệm (của tôi)' }], 'MANUAL', 'VOCAB');
    const taken = await T.takeEntry(mine, (await entry('店')).id);
    expect(taken.ok && taken.data.already).toBe(true);
    expect(await mine.item.count()).toBe(1);
    expect((await entry('店')).takeCount).toBe(0);
  });

  it('refuses an entry that is hidden or a group', async () => {
    const shop = await entry('店');
    await prisma.libraryEntry.update({ where: { id: shop.id }, data: { status: 'hidden' } });
    expect(await T.takeEntry(mine, shop.id)).toEqual({
      ok: false,
      error: 'Mục này không còn trên kho chung.',
    });
    expect((await T.takeEntry(mine, (await vocabGroup()).id)).ok).toBe(false);
    expect(await mine.item.count()).toBe(0);
  });
});

describe('takeGroup', () => {
  it("makes the learner's own group with a copy of every entry, keeping what they had", async () => {
    const P = await import('@/lib/library/practice');
    await P.addItems(mine, [{ expression: '静か', meaningVi: 'yên (của tôi)' }], 'MANUAL', 'VOCAB');
    const group = await vocabGroup();

    const taken = await T.takeGroup(mine, group.id);
    expect(taken).toEqual({
      ok: true,
      data: { groupId: expect.any(String), added: 2, already: 1 },
    });
    const g = await mine.group.findFirstOrThrow({
      include: { members: { include: { item: true } } },
    });
    expect(g).toMatchObject({ name: 'N5 · Từ vựng', kind: 'vocab', libraryEntryId: group.id });
    expect(g.members.map((m) => m.item.expression).sort()).toEqual(['切符', '店', '静か'].sort());
    // The learner's own 静か stays as they wrote it.
    expect((await mine.item.findFirstOrThrow({ where: { expression: '静か' } })).meaningVi).toBe(
      'yên (của tôi)',
    );
    expect((await vocabGroup()).takeCount).toBe(1);
    expect((await entry('店')).takeCount).toBe(1);
    expect((await entry('静か')).takeCount).toBe(0);
  });

  it('fills the same group when taken again, and leaves other learners alone', async () => {
    const group = await vocabGroup();
    await T.takeGroup(mine, group.id);
    await mine.item.deleteMany({ where: { expression: '切符' } });
    const again = await T.takeGroup(mine, group.id);
    expect(again.ok && again.data).toMatchObject({ added: 1, already: 2 });
    expect(await mine.group.count()).toBe(1);
    expect(await mine.groupMember.count()).toBe(3);
    expect(await other.item.count()).toBe(0);
    expect(await other.group.count()).toBe(0);
  });

  it('leaves out hidden entries and refuses a hidden group', async () => {
    const group = await vocabGroup();
    await prisma.libraryEntry.updateMany({
      where: { expression: '切符' },
      data: { status: 'hidden' },
    });
    const taken = await T.takeGroup(mine, group.id);
    expect(taken.ok && taken.data).toMatchObject({ added: 2, already: 0 });
    await prisma.libraryEntry.update({ where: { id: group.id }, data: { status: 'hidden' } });
    expect((await T.takeGroup(other, group.id)).ok).toBe(false);
  });
});
