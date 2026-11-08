import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-app-radicals-');

let R: typeof import('@/lib/app/radicals');
let prisma: (typeof import('@/lib/db/db'))['prisma'];
let db: UserDb;

beforeAll(async () => {
  R = await import('@/lib/app/radicals');
  ({ prisma } = await import('@/lib/db/db'));
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
});

const kanjiCard = (expression: string, state: number) =>
  db.item.create({
    data: {
      userId: db.$ownerId(),
      kind: 'KANJI',
      expression,
      meaningVi: '-',
      srs: { create: { userId: db.$ownerId(), due: new Date(), state } },
    },
  });

describe('radicals (KJ7)', () => {
  it('lists the 214 radicals by stroke count, each with its Jōyō kanji and the ones met', async () => {
    await kanjiCard('海', 2);
    // Waiting as new (taken from Kho chung, never shown): not met yet.
    await kanjiCard('池', 0);
    const list = await R.listRadicals(db);
    expect(list).toHaveLength(214);
    expect(list[0]).toMatchObject({ number: 1, radical: '一', strokes: 1 });
    expect(list.every((r, i) => i === 0 || list[i - 1].strokes <= r.strokes)).toBe(true);
    const total = (await import('@/lib/kanji/load')).kanjiCatalog();
    expect(list.reduce((n, r) => n + r.joyo, 0)).toBe((await total).length);
    const water = list.find((r) => r.number === 85)!;
    expect(water).toMatchObject({ radical: '水', nameVi: 'thủy', variants: ['氵'], met: 1 });
    expect(water.joyo).toBeGreaterThan(50);
  });

  it("opens a radical's kanji, easiest first, coloured by what the learner studied", async () => {
    await kanjiCard('海', 2);
    await kanjiCard('池', 0);
    const page = await R.getRadicalPage(db, 85);
    // 池 waits as new: coloured "đang chờ học", but not counted as met.
    expect(page?.radical).toMatchObject({ number: 85, met: 1 });
    expect(page?.kanji.find((k) => k.kanji === '海')).toEqual({
      kanji: '海',
      hanviet: 'HẢI',
      study: 'review',
    });
    expect(page?.kanji.find((k) => k.kanji === '池')?.study).toBe('new');
    expect(page?.kanji.find((k) => k.kanji === '水')?.study).toBe('none');
    expect(await R.getRadicalPage(db, 999)).toBeNull();
  });
});
