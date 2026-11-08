import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';

// Kanji cards (KJ3) live beside grammar and vocab in Item, so every reader that takes items of any
// kind has to leave them out or name them as kanji (review of #260). One kanji card is seeded and
// each such reader is asked about it.

createTestDb('sakubun-kanji-isolation-');

let prisma: (typeof import('@/lib/db/db'))['prisma'];
let db: UserDb;
let kanjiId: string;

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
  const kanji = await db.item.create({
    data: {
      userId: db.$ownerId(),
      kind: 'KANJI',
      expression: '日',
      hanviet: 'NHẬT',
      meaningVi: 'mặt trời; ngày',
      level: 'N5',
      source: 'JOYO',
      srs: { create: { userId: db.$ownerId(), due: new Date() } },
    },
  });
  kanjiId = kanji.id;
});

describe('a kanji card stays out of grammar and vocab readers', () => {
  it('MCP lookup does not list it as an item', async () => {
    const { findItems } = await import('@/lib/app/library');
    expect(await findItems(db, '日')).toEqual([]);
  });

  it('the Kaiwa word lookup reads 日 from OpenJLPT, not from the kanji card', async () => {
    const { lookupWords } = await import('@/lib/kaiwa/lookup');
    const found = await lookupWords(db, ['日']);
    expect(found['日']?.meaningVi).not.toBe('mặt trời; ngày');
  });

  it('has no item page, no group picker and cannot be published', async () => {
    const { getItemStats } = await import('@/lib/insights/item-stats');
    const { getItemGroupPicker } = await import('@/lib/library/groups');
    const { publishItem, itemShareStatus } = await import('@/lib/library/publish');
    expect(await getItemStats(db, kanjiId)).toBeNull();
    expect(await getItemGroupPicker(db, kanjiId)).toBeNull();
    expect(await itemShareStatus(db, kanjiId)).toBeNull();
    expect((await publishItem(db, kanjiId)).ok).toBe(false);
  });
});
