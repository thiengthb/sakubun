import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-library-script-rows-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let R: typeof import('@/lib/library/script-rows');
let L: typeof import('@/lib/library/scripts');
let K: typeof import('@/lib/kaiwa/scripts');
let author: UserDb;
let taker: UserDb;

const BODY = 'A: いらっしゃいませ。 | Xin mời vào.\nB: 二人です。 | Hai người.';

async function share(title: string, body = BODY) {
  const saved = await K.saveScript(author, { title, body });
  if (!saved.ok) throw new Error(saved.error);
  const res = await L.publishScript(author, saved.data.id);
  if (!res.ok) throw new Error(res.error);
  return { scriptId: saved.data.id, entryId: res.data.entryId };
}

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  R = await import('@/lib/library/script-rows');
  L = await import('@/lib/library/scripts');
  K = await import('@/lib/kaiwa/scripts');
  const { userDb } = await import('@/lib/db/user-db');
  author = userDb(await createTestUser(prisma, 'rows-author'));
  taker = userDb(await createTestUser(prisma, 'rows-taker'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
  await prisma.libraryEntry.deleteMany();
});

describe('libraryScriptRows', () => {
  it('says what the card shows, and what this learner has of each script', async () => {
    const a = await share('Ở nhà hàng');
    const b = await share('Ở ga', 'A: 駅はどこですか。 | Ga ở đâu?');
    const taken = await L.takeScript(taker, b.entryId);
    if (!taken.ok) throw new Error(taken.error);
    await L.takeScript(taker, a.entryId);
    // The taker has both; they like only "Ở nhà hàng".
    const { setLike } = await import('@/lib/library/likes');
    await setLike(taker, a.entryId, true);

    const rows = await R.libraryScriptRows(taker);
    const ga = rows.find((r) => r.id === b.entryId)!;
    expect(ga).toMatchObject({
      title: 'Ở ga',
      firstLine: '駅はどこですか。',
      lineCount: 1,
      speakers: ['A'],
      takeCount: 1,
      liked: false,
      myScriptId: taken.data.scriptId,
    });
    expect(rows.find((r) => r.id === a.entryId)).toMatchObject({ liked: true, likes: 1 });

    // The author's own share opens the script they shared it from.
    const mine = await R.libraryScriptRows(author);
    expect(mine.find((r) => r.id === a.entryId)?.myScriptId).toBe(a.scriptId);
  });

  it('searches by title and text', async () => {
    await share('Ở nhà hàng');
    await share('Ở ga', 'A: 駅はどこですか。 | Ga ở đâu?');
    expect((await R.libraryScriptRows(taker, 'ga')).map((r) => r.title)).toEqual(['Ở ga']);
    expect((await R.libraryScriptRows(taker, '二人')).map((r) => r.title)).toEqual(['Ở nhà hàng']);
  });
});
