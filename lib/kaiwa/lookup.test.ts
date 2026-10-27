import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { distinctSenses } from '@/lib/kaiwa/lookup';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-kaiwa-lookup-');

type Lookup = typeof import('@/lib/kaiwa/lookup');
type Db = typeof import('@/lib/db/db');
let L: Lookup;
let prisma: Db['prisma'];
let db: UserDb;
// A word in the OpenJLPT deck, with its Vietnamese meaning.
let deckWord: { expression: string; meaningVi: string };

beforeAll(async () => {
  L = await import('@/lib/kaiwa/lookup');
  ({ prisma } = await import('@/lib/db/db'));
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
  const deck = await (await import('@/lib/import/starter-deck')).loadStarterDeck();
  const word = deck.find((i) => i.kind === 'VOCAB' && i.expression === '会う');
  if (!word) throw new Error('会う is not in the OpenJLPT deck');
  deckWord = word;
}, 60_000);

beforeEach(async () => {
  await resetLearningData(prisma);
});

describe('lookupWords', () => {
  it("takes the learner's own meaning first, then OpenJLPT's, and leaves unknown words out", async () => {
    const P = await import('@/lib/library/practice');
    await P.addItems(
      db,
      [{ expression: '切符', meaningVi: 'vé (của tôi)', level: 'N4' }],
      'MCP',
      'VOCAB',
    );

    const found = await L.lookupWords(db, ['切符', '会う', '存在しない語']);
    expect(found['切符']).toMatchObject({ meaningVi: 'vé (của tôi)', itemId: expect.any(String) });
    expect(found['会う']).toMatchObject({
      meaningVi: distinctSenses(deckWord.meaningVi),
      itemId: null,
    });
    expect(found['存在しない語']).toBeUndefined();
  });

  it("never reads another learner's items", async () => {
    const other = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'other'));
    const P = await import('@/lib/library/practice');
    await P.addItems(
      other,
      [{ expression: '切符', meaningVi: 'vé của người khác', level: 'N4' }],
      'MCP',
      'VOCAB',
    );
    const found = (await L.lookupWords(db, ['切符']))['切符'];
    expect(found?.itemId ?? null).toBeNull();
    expect(found?.meaningVi).not.toBe('vé của người khác');
  });
});

describe('addOpenJlptWord', () => {
  it('adds the OpenJLPT word with its own schedule, once', async () => {
    const added = await L.addOpenJlptWord(db, '会う');
    expect(added).toEqual({ itemId: expect.any(String) });
    expect(await db.srsState.count()).toBe(1);
    expect((await L.lookupWords(db, ['会う']))['会う']?.itemId).toBe(
      'itemId' in added ? added.itemId : null,
    );

    expect(await L.addOpenJlptWord(db, '会う')).toEqual({
      reason: 'Không thêm được: đã có trong kho.',
    });
    expect(await L.addOpenJlptWord(db, '存在しない語')).toEqual({
      reason: 'Không có từ này trong OpenJLPT.',
    });
  });
});

describe('distinctSenses', () => {
  it('keeps each sense once, in order', () => {
    expect(distinctSenses('cửa hàng; cửa hàng; tiệm')).toBe('cửa hàng; tiệm');
    expect(distinctSenses('Trong; ở giữa; trong; ở giữa; trong số')).toBe(
      'Trong; ở giữa; trong số',
    );
    expect(distinctSenses('vé')).toBe('vé');
  });
});
