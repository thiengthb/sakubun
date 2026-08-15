import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createTestDb, resetLearningData } from '@/lib/test-db';

createTestDb('sakubun-trpc-');

type Router = typeof import('@/lib/trpc/router');
type Init = typeof import('@/lib/trpc/init');
type Context = typeof import('@/lib/trpc/context');
type Db = typeof import('@/lib/db');

let appRouter: Router['appRouter'];
let createCallerFactory: Init['createCallerFactory'];
let createTrpcContext: Context['createTrpcContext'];
let prisma: Db['prisma'];

const SIGNED_IN = { user: { id: 'u1', email: 'a@b.c', name: 'Người học' } };
const SIGNED_OUT = { user: null };

beforeAll(async () => {
  ({ appRouter } = await import('@/lib/trpc/router'));
  ({ createCallerFactory } = await import('@/lib/trpc/init'));
  ({ createTrpcContext } = await import('@/lib/trpc/context'));
  ({ prisma } = await import('@/lib/db'));
}, 60_000);

const caller = (ctx: { user: { id: string; email: string; name: string } | null }) =>
  createCallerFactory(appRouter)(ctx);

beforeEach(async () => {
  await resetLearningData(prisma);
});

describe('authConfig', () => {
  it('answers WITHOUT a session — the login screen has no session yet', async () => {
    const config = await caller(SIGNED_OUT).authConfig();
    expect(typeof config.googleEnabled).toBe('boolean');
  });
});

describe('the guard', () => {
  it('refuses `me` without a session', async () => {
    await expect(caller(SIGNED_OUT).me()).rejects.toThrow(TRPCError);
    await expect(caller(SIGNED_OUT).me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('refuses `snapshot` without a session — the library is not readable by nobody', async () => {
    await expect(caller(SIGNED_OUT).snapshot()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('lets a signed-in caller through and echoes who they are', async () => {
    await expect(caller(SIGNED_IN).me()).resolves.toEqual(SIGNED_IN.user);
  });

  it('resolves a header-less Request to no user, rather than throwing', async () => {
    await expect(createTrpcContext(new Request('http://localhost/api/trpc/me'))).resolves.toEqual({
      user: null,
    });
  });
});

describe('snapshot', () => {
  it('is JSON-safe end to end: no Date object survives the output schema', async () => {
    const now = new Date('2026-08-06T02:00:00.000Z');
    await prisma.item.create({
      data: {
        id: 'it1',
        kind: 'GRAMMAR',
        expression: '〜ばかりに',
        meaningVi: 'chỉ vì',
        level: 'N2',
        tags: JSON.stringify(['nguyên nhân', 'văn viết']),
        createdAt: now,
        srs: { create: { due: now, reps: 3, state: 2, lastReview: now } },
      },
    });

    const snap = await caller(SIGNED_IN).snapshot();

    expect(snap.counts).toEqual({ items: 1, groups: 0 });
    expect(snap.items[0]).toMatchObject({
      id: 'it1',
      expression: '〜ばかりに',
      tags: ['nguyên nhân', 'văn viết'],
      createdAt: '2026-08-06T02:00:00.000Z',
    });
    expect(snap.items[0].srs).toMatchObject({
      due: '2026-08-06T02:00:00.000Z',
      reps: 3,
      state: 2,
      lastReview: '2026-08-06T02:00:00.000Z',
    });
    expect(typeof snap.takenAt).toBe('string');
  });

  it('reports srs as null for an item that has never been reviewed', async () => {
    await prisma.item.create({
      data: { id: 'it2', kind: 'VOCAB', expression: '会う', meaningVi: 'gặp', level: 'N5' },
    });
    const snap = await caller(SIGNED_IN).snapshot();
    expect(snap.items[0].srs).toBeNull();
  });

  it('survives a malformed tags column instead of failing the whole library', async () => {
    await prisma.item.create({
      data: {
        id: 'it3',
        kind: 'GRAMMAR',
        expression: '〜わけだ',
        meaningVi: 'thì ra là',
        level: 'N3',
        tags: '{not json',
      },
    });
    const snap = await caller(SIGNED_IN).snapshot();
    expect(snap.items[0].tags).toEqual([]);
  });

  it('flattens group membership onto the group, so the client never joins two arrays', async () => {
    const now = new Date('2026-08-06T02:00:00.000Z');
    await prisma.item.createMany({
      data: [
        { id: 'g-a', kind: 'GRAMMAR', expression: '〜つつ', meaningVi: 'vừa', level: 'N2' },
        { id: 'g-b', kind: 'GRAMMAR', expression: '〜がてら', meaningVi: 'nhân lúc', level: 'N1' },
      ],
    });
    await prisma.group.create({
      data: { id: 'grp1', name: 'Nhóm thử', kind: 'grammar', createdAt: now, updatedAt: now },
    });
    await prisma.groupMember.createMany({
      data: [
        { groupId: 'grp1', itemId: 'g-a' },
        { groupId: 'grp1', itemId: 'g-b' },
      ],
    });

    const snap = await caller(SIGNED_IN).snapshot();
    expect(snap.counts.groups).toBe(1);
    expect(snap.groups[0]).toMatchObject({ id: 'grp1', name: 'Nhóm thử', kind: 'grammar' });
    expect([...snap.groups[0].itemIds].sort()).toEqual(['g-a', 'g-b']);
  });

  it('has a schema that actually rejects a Date — the guarantee, not just the intent', async () => {
    const { mobileSnapshotSchema } = await import('@/lib/mobile-snapshot');
    await prisma.item.create({
      data: { id: 'leak', kind: 'VOCAB', expression: '猫', meaningVi: 'mèo', level: 'N5' },
    });
    const good = await caller(SIGNED_IN).snapshot();
    expect(mobileSnapshotSchema.safeParse(good).success).toBe(true);

    const leaked = {
      ...good,
      items: [{ ...good.items[0], createdAt: new Date('2026-08-06T02:00:00.000Z') }],
    };
    const verdict = mobileSnapshotSchema.safeParse(leaked);
    expect(verdict.success).toBe(false);
    expect(verdict.error?.issues[0]?.path).toEqual(['items', 0, 'createdAt']);
  });

  it('carries settings the client must not recompute', async () => {
    const snap = await caller(SIGNED_IN).snapshot();
    expect(snap.settings).toMatchObject({ dayCutoffHour: expect.any(Number) });
  });
});

describe('stats', () => {
  it('refuses an unauthenticated caller', async () => {
    await expect(caller(SIGNED_OUT).stats()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('answers with a shape that satisfies its own output schema', async () => {
    const stats = await caller(SIGNED_IN).stats();
    expect(typeof stats.takenAt).toBe('string');
    expect(stats.today).toMatchObject({ reviews: expect.any(Number) });
    expect(stats.reviewsByDay).toHaveLength(7);
  });

  it('applies the study-day cutoff — the reason the client is never given the ingredients', async () => {
    const { saveSettings } = await import('@/lib/practice');
    const { invalidateStreak } = await import('@/lib/practice');
    const { buildMobileStats } = await import('@/lib/mobile-stats');

    await saveSettings({ dayCutoffHour: 4 });
    await prisma.item.create({
      data: { id: 'cut1', kind: 'GRAMMAR', expression: '〜ものの', meaningVi: 'mặc dù', level: 'N2' },
    });
    const log = (at: Date) =>
      prisma.reviewLog.create({
        data: { itemId: 'cut1', rating: 3, state: 2, due: at, stability: 1, difficulty: 5, reviewedAt: at },
      });

    const now = new Date(2026, 7, 6, 10, 0, 0); // 06/08/2026 10:00 local
    await log(new Date(2026, 7, 6, 2, 0, 0)); // 02:00 — BEFORE the cutoff, so it is yesterday's work
    invalidateStreak();

    let stats = await buildMobileStats(now);
    expect(stats.today.reviews).toBe(0);

    await log(new Date(2026, 7, 6, 5, 0, 0)); // 05:00 — after the cutoff, today
    invalidateStreak();

    stats = await buildMobileStats(now);
    expect(stats.today.reviews).toBe(1);

    await prisma.reviewLog.deleteMany();
    invalidateStreak();
  });

  it('never recomputes: it projects the same getStats() the web dashboard calls', async () => {
    const { getStats } = await import('@/lib/practice');
    const { buildMobileStats } = await import('@/lib/mobile-stats');
    const now = new Date(2026, 7, 6, 10, 0, 0);
    const [web, mobile] = await Promise.all([getStats(now), buildMobileStats(now)]);
    expect(mobile.dueNow).toBe(web.dueNow);
    expect(mobile.totalItems).toBe(web.totalItems);
    expect(mobile.today).toEqual(web.today);
    expect(mobile.sessionGoal).toBe(web.settings.sessionGoal);
  });

});
