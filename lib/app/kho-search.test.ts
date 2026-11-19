import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';
import type { StarterItem } from '@/lib/import/starter-deck';

createTestDb('sakubun-app-kho-search-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let K: typeof import('@/lib/app/kho-search');
let P: typeof import('@/lib/library/practice');
let mine: UserDb;
let other: UserDb;

const NOW = new Date('2030-01-15T03:00:00.000Z');

const starter = (
  expression: string,
  meaningVi: string,
  reading: string | null = null,
): StarterItem => ({
  id: `VOCAB-${expression}`,
  kind: 'VOCAB',
  expression,
  reading,
  hanviet: null,
  meaningVi,
  level: 'N5',
  notes: '',
  tags: '[]',
  source: 'OPENJLPT',
  suspended: false,
  starred: false,
});

const add = (db: UserDb, expression: string, meaningVi = 'nghĩa') =>
  P.addItems(db, [{ expression, meaningVi }], 'MANUAL', 'VOCAB');

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  K = await import('@/lib/app/kho-search');
  P = await import('@/lib/library/practice');
  const S = await import('@/lib/library/shared');
  const { userDb } = await import('@/lib/db/user-db');
  mine = userDb(await createTestUser(prisma, 'learner'));
  other = userDb(await createTestUser(prisma, 'other'));
  await prisma.libraryEntry.deleteMany();
  await S.seedOpenJlpt(prisma, [
    starter('会う', 'gặp', 'あう'),
    starter('会話', 'hội thoại'),
    starter('社会', 'xã hội'),
    starter('店', 'cửa hàng'),
  ]);
});

beforeEach(async () => {
  await resetLearningData(prisma);
});

describe('searchKho (U4f)', () => {
  it("finds the learner's own items, and leaves them out of Kho chung's side", async () => {
    await add(mine, '会議室', 'phòng họp');
    await add(mine, '会う', 'gặp');
    await add(other, '会話', 'hội thoại');

    const found = await K.searchKho(mine, '会', NOW);
    // The exact word is not here, so the shorter one comes first.
    expect(found.mine.map((m) => m.expression)).toEqual(['会う', '会議室']);
    expect(found.mine[0].state).toBe('new');
    expect(found.mineCount).toBe(2);
    // 会う is owned; another learner's 会話 does not count as owned.
    expect(found.library.map((e) => e.expression).sort()).toEqual(['会話', '社会']);
    expect(found.libraryCount).toBe(2);
    expect(found.libraryHref).toBe('/library?tab=items&q=%E4%BC%9A&hide=1');
  });

  it("hides an owned word from Kho chung even when only Kho chung's copy matches", async () => {
    // The learner's 会う has no reading; Kho chung's has あう, so only Kho chung's copy matches.
    await add(mine, '会う', 'gặp gỡ');
    const found = await K.searchKho(mine, 'あう', NOW);
    expect(found.mine).toEqual([]);
    expect(found.library).toEqual([]);
    expect(found.libraryCount).toBe(0);
  });

  it('matches a meaning too, and an empty query finds nothing', async () => {
    await add(mine, '店', 'cửa hàng');
    const byMeaning = await K.searchKho(mine, 'cửa hàng', NOW);
    expect(byMeaning.mine.map((m) => m.expression)).toEqual(['店']);
    expect(byMeaning.libraryCount).toBe(0);

    const empty = await K.searchKho(mine, '  「」 ', NOW);
    expect(empty).toMatchObject({ query: '', mine: [], library: [], libraryCount: 0 });
  });
});
