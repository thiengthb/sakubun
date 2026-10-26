import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestUser, createTestDb } from '@/lib/db/test-db';

createTestDb('sakubun-review-load-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let db: UserDb;
let getReviewLoad: typeof import('@/lib/library/review-load').getReviewLoad;

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
  ({ getReviewLoad } = await import('@/lib/library/review-load'));
});

beforeEach(async () => {
  await db.srsState.deleteMany({});
  await db.item.deleteMany({});
});

const NOW = new Date(2026, 9, 10, 12, 0, 0); // 10 Oct 2026 noon local, after the 4 AM cutoff
const at = (dayOffset: number, hour = 12) => new Date(2026, 9, 10 + dayOffset, hour, 0, 0);

async function item(
  kind: string,
  expression: string,
  srs: { reps: number; state: number; due: Date },
) {
  await db.item.create({
    data: {
      kind,
      expression,
      meaningVi: 'x',
      srs: {
        create: {
          due: srs.due,
          stability: 1,
          difficulty: 5,
          scheduledDays: 1,
          learningSteps: 0,
          reps: srs.reps,
          lapses: 0,
          state: srs.state,
          userId: db.$ownerId(),
        },
      },
    },
  });
}

describe('getReviewLoad', () => {
  it('đếm ôn theo ngày học, quá hạn tính vào ngày đầu, mẫu mới theo hạn mức', async () => {
    await item('GRAMMAR', 'a', { reps: 2, state: 2, due: at(-3) }); // overdue → day 1
    await item('GRAMMAR', 'b', { reps: 2, state: 2, due: at(1) });
    await item('VOCAB', 'c', { reps: 1, state: 2, due: at(1) });
    await item('GRAMMAR', 'd', { reps: 1, state: 2, due: at(2, 2) }); // 2 AM belongs to the day before
    await item('GRAMMAR', 'n1', { reps: 0, state: 0, due: at(0) });
    await item('GRAMMAR', 'n2', { reps: 0, state: 0, due: at(0) });
    await item('GRAMMAR', 'n3', { reps: 0, state: 0, due: at(0) });
    await item('GRAMMAR', 'n4', { reps: 0, state: 0, due: at(0) });

    const load = await getReviewLoad(db, 3, NOW);
    expect(load.days.map((d) => d.date)).toEqual(['2026-10-10', '2026-10-11', '2026-10-12']);
    expect(load.days.map((d) => d.grammarDue)).toEqual([1, 2, 0]);
    expect(load.days.map((d) => d.vocabDue)).toEqual([0, 1, 0]);
    // default dailyNewGrammar = 3, four new patterns left
    expect(load.days.map((d) => d.newGrammarPlanned)).toEqual([3, 1, 0]);
    expect(load.newGrammarRemaining).toBe(4);
  });
});
