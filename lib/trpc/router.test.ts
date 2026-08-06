// The mobile transport's two load-bearing behaviours, against a REAL throwaway SQLite DB.
//
// 1. THE GUARD. The learning tables have no `userId` column — the boundary is the LOGIN (AGENTS.md) —
//    so `protectedProcedure` IS the boundary for this surface. A test that only checked the happy path
//    would pass just as well on a router that had no guard at all, which is the failure worth catching.
//
// 2. THE OUTPUT SCHEMA. `lib/trpc/init.ts` deliberately ships no superjson, and the whole reason that is
//    safe is that every procedure declares its wire shape. A `Date` object reaching the client would
//    type as `Date` and arrive as a string; here it throws instead. These tests are what make that claim
//    true rather than a comment.
//
// Driven through `createCallerFactory` with a hand-built context: the guard and the schema are what is
// under test, not HTTP. The real header -> session path is covered by `createTrpcContext` below, and the
// real 401 over the wire belongs to e2e.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createTestDb } from '@/lib/test-db';

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
});

const caller = (ctx: { user: { id: string; email: string; name: string } | null }) =>
  createCallerFactory(appRouter)(ctx);

beforeEach(async () => {
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.srsState.deleteMany();
  await prisma.item.deleteMany();
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
    // A native client with an empty cookie jar (first launch, or after sign-out) hits exactly this.
    await expect(createTrpcContext(new Request('http://localhost/api/trpc/me'))).resolves.toEqual({
      user: null,
    });
  });
});

describe('snapshot', () => {
  it('is JSON-safe end to end: no Date object survives the output schema', async () => {
    // If any Date reached the wire, `.output(mobileSnapshotSchema)` would reject it here. That is the
    // whole safety argument for shipping without a transformer.
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
    // Tags are a JSON string because SQLite has no lists. One bad row must cost that row's tags, not
    // the snapshot — a client that cannot sync at all is worse than a card with no tags.
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
    // The test above passes because nothing leaked. This one proves the net has holes small enough to
    // catch it: without this, "the output schema protects us" is an untested claim about a mechanism.
    const { mobileSnapshotSchema } = await import('@/lib/mobile-snapshot');
    await prisma.item.create({
      data: { id: 'leak', kind: 'VOCAB', expression: '猫', meaningVi: 'mèo', level: 'N5' },
    });
    const good = await caller(SIGNED_IN).snapshot();
    expect(mobileSnapshotSchema.safeParse(good).success).toBe(true);

    // The SAME payload with one field left as Prisma returned it. Nothing else differs.
    const leaked = {
      ...good,
      items: [{ ...good.items[0], createdAt: new Date('2026-08-06T02:00:00.000Z') }],
    };
    const verdict = mobileSnapshotSchema.safeParse(leaked);
    expect(verdict.success).toBe(false);
    expect(verdict.error?.issues[0]?.path).toEqual(['items', 0, 'createdAt']);
  });

  it('carries settings the client must not recompute', async () => {
    // The day cutoff and the daily goal are SERVER truth (ADR 0001, decision 4) — the app displays
    // them, it never derives a study day itself.
    const snap = await caller(SIGNED_IN).snapshot();
    expect(snap.settings).toMatchObject({ dayCutoffHour: expect.any(Number) });
  });
});
