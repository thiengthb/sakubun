import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';
import type { StarterItem } from '@/lib/import/starter-deck';

createTestDb('sakubun-app-item-place-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let I: typeof import('@/lib/app/item-place');
let P: typeof import('@/lib/library/practice');
let mine: UserDb;

const starter = (kind: string, expression: string, level = 'N5'): StarterItem => ({
  id: `${kind}-${expression}`,
  kind,
  expression,
  reading: null,
  hanviet: null,
  meaningVi: 'nghĩa',
  level,
  notes: '',
  tags: '[]',
  source: 'OPENJLPT',
  suspended: false,
  starred: false,
});

// 25 N5 words: the 21st and later fall in the second set.
const WORDS = Array.from({ length: 25 }, (_, i) => `語${String(i).padStart(2, '0')}`);

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  I = await import('@/lib/app/item-place');
  P = await import('@/lib/library/practice');
  const S = await import('@/lib/library/shared');
  const { userDb } = await import('@/lib/db/user-db');
  mine = userDb(await createTestUser(prisma, 'learner'));
  await prisma.libraryEntry.deleteMany();
  await S.seedOpenJlpt(prisma, [
    ...WORDS.map((w) => starter('VOCAB', w)),
    starter('GRAMMAR', '〜ばかりに', 'N2'),
  ]);
});

beforeEach(async () => {
  await resetLearningData(prisma);
});

const own = async (expression: string, source: 'MANUAL' | 'MCP' = 'MANUAL', kind = 'VOCAB') => {
  await P.addItems(mine, [{ expression, meaningVi: 'nghĩa' }], source, kind);
  const item = await mine.item.findFirstOrThrow({ where: { expression } });
  return I.itemPlaceById(mine, item.id);
};

describe('itemPlace (KN1)', () => {
  it("puts a word OpenJLPT lists in its level's set, as the level screen cuts it", async () => {
    expect(await own(WORDS[0])).toEqual({ way: 'levels', level: 'N5', kind: 'vocab', set: 1 });
    expect(await own(WORDS[21])).toEqual({ way: 'levels', level: 'N5', kind: 'vocab', set: 2 });
    expect(await own('〜ばかりに', 'MANUAL', 'GRAMMAR')).toEqual({
      way: 'levels',
      level: 'N2',
      kind: 'grammar',
      set: 1,
    });
  });

  it('puts any other word under Ngoài JLPT by where it came from', async () => {
    expect(await own('自作', 'MCP')).toEqual({ way: 'outside', source: 'mcp' });
    expect(await own('手書き')).toEqual({ way: 'outside', source: 'manual' });
  });

  it('has no place for an item the learner does not have', async () => {
    expect(await I.itemPlaceById(mine, 'missing')).toBeNull();
  });
});
