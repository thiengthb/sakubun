import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-user-db-');

type UserDbModule = typeof import('@/lib/db/user-db');
type Db = typeof import('@/lib/db/db');
let U: UserDbModule;
let prisma: Db['prisma'];
let unguardedPrisma: Db['unguardedPrisma'];

const SRS = {
  due: new Date('2030-01-15T00:00:00.000Z'),
  stability: 1,
  difficulty: 5,
  scheduledDays: 0,
  learningSteps: 0,
  reps: 0,
  lapses: 0,
  state: 0,
};

beforeAll(async () => {
  U = await import('@/lib/db/user-db');
  ({ prisma, unguardedPrisma } = await import('@/lib/db/db'));
  await createTestUser(prisma, 'learner-a');
  await createTestUser(prisma, 'learner-b');
});

beforeEach(async () => {
  await resetLearningData(prisma);
});

async function seedItem(userId: string, expression: string) {
  const db = U.userDb(userId);
  return db.item.create({
    data: {
      userId: db.$ownerId(),
      kind: 'VOCAB',
      expression,
      meaningVi: 'nghĩa',
      srs: { create: { ...SRS, userId: db.$ownerId() } },
    },
  });
}

describe('userDb', () => {
  it('writes the owner on create, createMany and upsert', async () => {
    const a = U.userDb('learner-a');
    const item = await seedItem('learner-a', '猫');
    // No userId in the data: the scope writes it. The generated types require it, hence `as never`.
    await a.group.createMany({ data: [{ name: 'Một' }, { name: 'Hai' }] as never });
    await a.settings.upsert({
      where: { userId: 'learner-a' },
      create: { data: '{}' } as never,
      update: {},
    });

    expect(await unguardedPrisma.item.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({
      userId: 'learner-a',
    });
    expect(
      await unguardedPrisma.srsState.findUniqueOrThrow({ where: { itemId: item.id } }),
    ).toMatchObject({
      userId: 'learner-a',
    });
    expect(await unguardedPrisma.group.findMany({ select: { userId: true } })).toEqual([
      { userId: 'learner-a' },
      { userId: 'learner-a' },
    ]);
    expect(await unguardedPrisma.settings.findFirstOrThrow()).toMatchObject({
      userId: 'learner-a',
    });
  });

  it("never reads another learner's rows", async () => {
    const mine = await seedItem('learner-b', '犬');
    const theirs = await seedItem('learner-a', '猫');
    const b = U.userDb('learner-b');

    expect((await b.item.findMany()).map((i) => i.id)).toEqual([mine.id]);
    expect(await b.item.count()).toBe(1);
    expect(await b.item.findUnique({ where: { id: theirs.id } })).toBeNull();
    expect(await b.item.findFirst({ where: { expression: '猫' } })).toBeNull();
    expect(await b.srsState.findUnique({ where: { itemId: theirs.id } })).toBeNull();
    expect(await b.item.groupBy({ by: ['kind'], _count: true })).toEqual([
      { kind: 'VOCAB', _count: 1 },
    ]);
    expect((await b.srsState.aggregate({ _count: true }))._count).toBe(1);
  });

  it("cannot change or delete another learner's rows", async () => {
    const theirs = await seedItem('learner-a', '猫');
    const b = U.userDb('learner-b');

    await expect(
      b.item.update({ where: { id: theirs.id }, data: { meaningVi: 'đổi' } }),
    ).rejects.toMatchObject({ code: 'P2025' });
    await expect(b.item.delete({ where: { id: theirs.id } })).rejects.toMatchObject({
      code: 'P2025',
    });
    expect((await b.item.updateMany({ data: { starred: true } })).count).toBe(0);
    expect((await b.item.deleteMany({})).count).toBe(0);

    expect(
      await unguardedPrisma.item.findUniqueOrThrow({ where: { id: theirs.id } }),
    ).toMatchObject({
      meaningVi: 'nghĩa',
      starred: false,
    });
  });

  it('refuses to hand a row to another learner', async () => {
    const mine = await seedItem('learner-b', '犬');
    const b = U.userDb('learner-b');

    await expect(
      b.item.update({ where: { id: mine.id }, data: { userId: 'learner-a' } }),
    ).rejects.toThrow(/cannot change userId/);
    await expect(b.item.updateMany({ data: { userId: 'learner-a' } })).rejects.toThrow(
      /cannot change userId/,
    );
  });

  it('keeps the scope inside an interactive transaction', async () => {
    await seedItem('learner-a', '猫');
    const b = U.userDb('learner-b');

    const seen = await b.$transaction(async (tx) => {
      await tx.item.create({
        data: { kind: 'VOCAB', expression: '鳥', meaningVi: 'chim' } as never,
      });
      return tx.item.findMany({ select: { expression: true, userId: true } });
    });

    expect(seen).toEqual([{ expression: '鳥', userId: 'learner-b' }]);
  });

  it('leaves tables outside the learning data alone', async () => {
    const b = U.userDb('learner-b');
    expect(await b.user.count()).toBe(await prisma.user.count());
  });
});
