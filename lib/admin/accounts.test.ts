import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-admin-accounts-');

type Accounts = typeof import('./accounts');
let A: Accounts;
let prisma: typeof import('@/lib/db/db').prisma;
let userDb: typeof import('@/lib/db/user-db').userDb;

beforeAll(async () => {
  A = await import('./accounts');
  ({ prisma } = await import('@/lib/db/db'));
  ({ userDb } = await import('@/lib/db/user-db'));
});

async function learnerWithOneReview(id: string) {
  await createTestUser(prisma, id);
  await prisma.user.update({ where: { id }, data: { role: 'user' } });
  const db = userDb(id);
  const item = await db.item.create({
    data: { userId: id, kind: 'VOCAB', expression: `${id}-猫`, meaningVi: 'mèo' },
  });
  await db.reviewLog.create({
    data: {
      userId: id,
      itemId: item.id,
      rating: 3,
      state: 2,
      due: new Date('2026-10-30T00:00:00Z'),
      stability: 1,
      difficulty: 5,
      reviewedAt: new Date('2026-10-27T01:00:00Z'),
    },
  });
  await prisma.session.create({
    data: { id: `${id}-s`, token: `${id}-t`, userId: id, expiresAt: new Date('2027-01-01') },
  });
}

describe('admin accounts', () => {
  it('liệt kê mọi tài khoản với lần ôn cuối của riêng họ', async () => {
    await resetLearningData(prisma);
    await learnerWithOneReview('acc-a');
    await createTestUser(prisma, 'acc-empty');

    const rows = await A.listAccounts();
    const a = rows.find((r) => r.id === 'acc-a');
    expect(a).toMatchObject({ access: 'learner', banned: false });
    expect(a?.lastReviewAt?.toISOString()).toBe('2026-10-27T01:00:00.000Z');
    expect(rows.find((r) => r.id === 'acc-empty')).toMatchObject({
      lastReviewAt: null,
      access: 'none',
    });
  });

  it('một tài khoản: lần ôn cuối và lần đăng nhập gần nhất; id lạ thì null', async () => {
    await resetLearningData(prisma);
    await learnerWithOneReview('acc-one');

    const one = await A.getAccount('acc-one');
    expect(one).toMatchObject({ id: 'acc-one', access: 'learner', banned: false });
    expect(one?.lastReviewAt?.toISOString()).toBe('2026-10-27T01:00:00.000Z');
    expect(one?.lastSignInAt).toBeInstanceOf(Date);
    expect(await A.getAccount('no-such-account')).toBeNull();
  });

  it('chặn thì phiên đang mở bị xoá, dữ liệu học còn nguyên; bỏ chặn thì vào lại được', async () => {
    await resetLearningData(prisma);
    await learnerWithOneReview('acc-ban');

    await A.setBanned('acc-ban', true);
    expect(await prisma.user.findUnique({ where: { id: 'acc-ban' } })).toMatchObject({
      banned: true,
    });
    expect(await prisma.session.count({ where: { userId: 'acc-ban' } })).toBe(0);
    expect(await userDb('acc-ban').item.count()).toBe(1);

    await A.setBanned('acc-ban', false);
    expect(await prisma.user.findUnique({ where: { id: 'acc-ban' } })).toMatchObject({
      banned: false,
      banReason: null,
    });
  });

  it('xoá tài khoản thì xoá dữ liệu học của người đó, không đụng người khác', async () => {
    await resetLearningData(prisma);
    await learnerWithOneReview('acc-del');
    await learnerWithOneReview('acc-keep');

    await A.deleteAccount('acc-del');

    expect(await prisma.user.count({ where: { id: 'acc-del' } })).toBe(0);
    expect(await userDb('acc-del').item.count()).toBe(0);
    expect(await userDb('acc-del').reviewLog.count()).toBe(0);
    expect(await prisma.session.count({ where: { userId: 'acc-del' } })).toBe(0);
    expect(await userDb('acc-keep').item.count()).toBe(1);
    expect(await userDb('acc-keep').reviewLog.count()).toBe(1);
  });
});
