import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser } from '@/lib/db/test-db';
import type { StarterItem } from '@/lib/import/starter-deck';

// Review of #310: a level pick cut short (a restart while it runs) must still leave the level
// saved, or the patterns already taken at N4–N1 would never come up for study.
vi.mock('@/lib/library/take', async (original) => ({
  ...(await original<typeof import('@/lib/library/take')>()),
  takeGroup: vi.fn().mockRejectedValue(new Error('cut short')),
}));

createTestDb('sakubun-app-start-level-order-');

const item = (kind: string, expression: string): StarterItem => ({
  id: `${kind}-${expression}`,
  kind,
  expression,
  reading: null,
  hanviet: null,
  meaningVi: 'nghĩa',
  level: 'N3',
  notes: '',
  tags: '[]',
  source: 'OPENJLPT',
  suspended: false,
  starred: false,
});

let db: UserDb;

beforeAll(async () => {
  const { prisma } = await import('@/lib/db/db');
  const { seedOpenJlpt } = await import('@/lib/library/shared');
  await seedOpenJlpt(prisma, [item('GRAMMAR', '〜ばかりに'), item('VOCAB', '経済')]);
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'newcomer'));
});

describe('startAtLevel cut short', () => {
  it('has saved the level before taking anything', async () => {
    const { startAtLevel } = await import('@/lib/app/start-level');
    await expect(startAtLevel(db, 'N3')).rejects.toThrow('cut short');
    const { getSettings } = await import('@/lib/library/practice');
    const settings = await getSettings(db);
    expect([settings.grammarLevel, settings.vocabLevel]).toEqual(['N3', 'N3']);
  });
});
