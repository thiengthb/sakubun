import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';
import type { StarterItem } from '@/lib/import/starter-deck';

createTestDb('sakubun-app-start-level-');

let prisma: (typeof import('@/lib/db/db'))['prisma'];
let S: typeof import('@/lib/app/start-level');
let P: typeof import('@/lib/library/practice');
let db: UserDb;

const NOW = new Date('2030-01-15T03:00:00.000Z');

const item = (kind: string, expression: string, level: string): StarterItem => ({
  id: `${kind}-${expression}`,
  kind,
  expression,
  reading: kind === 'VOCAB' ? 'よみ' : null,
  hanviet: null,
  meaningVi: 'nghĩa',
  level,
  notes: '',
  tags: '[]',
  source: 'OPENJLPT',
  suspended: false,
  starred: false,
});

const DECK = [
  item('GRAMMAR', '〜てから', 'N5'),
  item('GRAMMAR', '〜たい', 'N5'),
  item('VOCAB', '店', 'N5'),
  item('VOCAB', '切符', 'N5'),
  item('VOCAB', '静か', 'N5'),
  item('GRAMMAR', '〜ばかり', 'N4'),
  item('VOCAB', '経験', 'N4'),
];

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  S = await import('@/lib/app/start-level');
  P = await import('@/lib/library/practice');
  const { userDb } = await import('@/lib/db/user-db');
  db = userDb(await createTestUser(prisma, 'newcomer'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
  await prisma.libraryEntry.deleteMany();
  const { seedOpenJlpt } = await import('@/lib/library/shared');
  await seedOpenJlpt(prisma, DECK);
});

describe('startAtLevel (U3c)', () => {
  it("takes the level's grammar, words and kanji, and studies from that level", async () => {
    const res = await S.startAtLevel(db, 'N5', NOW);
    expect(res.ok && res.data.grammar).toBe(2);
    expect(res.ok && res.data.vocab).toBe(3);
    expect(res.ok && res.data.kanji).toBeGreaterThan(0);

    const items = await db.item.findMany({ select: { kind: true, level: true } });
    expect(items.filter((i) => i.kind === 'GRAMMAR')).toHaveLength(2);
    expect(items.filter((i) => i.kind === 'VOCAB')).toHaveLength(3);
    expect(items.filter((i) => i.kind !== 'KANJI').every((i) => i.level === 'N5')).toBe(true);
    const settings = await P.getSettings(db);
    expect([settings.grammarLevel, settings.vocabLevel]).toEqual(['N5', 'N5']);
  });

  it('picked again, it only fills what is missing', async () => {
    await S.startAtLevel(db, 'N5', NOW);
    const before = await db.item.count();
    const again = await S.startAtLevel(db, 'N5', NOW);
    expect(again).toEqual({ ok: true, data: { grammar: 0, vocab: 0, kanji: 0 } });
    expect(await db.item.count()).toBe(before);
  });

  it('says so when Kho chung has nothing for the level', async () => {
    const res = await S.startAtLevel(db, 'N2', NOW);
    expect(res.ok).toBe(false);
    expect(await db.item.count()).toBe(0);
  });
});
