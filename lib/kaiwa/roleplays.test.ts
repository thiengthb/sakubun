import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-kaiwa-roleplays-');

type Scripts = typeof import('@/lib/kaiwa/scripts');
type Roleplays = typeof import('@/lib/kaiwa/roleplays');
type Db = typeof import('@/lib/db/db');
let S: Scripts;
let R: Roleplays;
let prisma: Db['prisma'];
let db: UserDb;

const BODY = 'A: いらっしゃいませ。 | Xin mời vào.\nB: 二人[ふたり]です。 | Hai người.';

beforeAll(async () => {
  S = await import('@/lib/kaiwa/scripts');
  R = await import('@/lib/kaiwa/roleplays');
  ({ prisma } = await import('@/lib/db/db'));
  db = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
});

async function played() {
  const script = await S.saveScript(db, { title: 'Ở nhà hàng', body: BODY });
  if (!script.ok) throw new Error(script.error);
  const saved = await R.saveRoleplay(db, {
    scriptId: script.data.id,
    part: 'B',
    turns: [{ turn: 2, said: '二人です', ok: true }],
  });
  if (!saved.ok) throw new Error(saved.error);
  return script.data;
}

describe('listRoleplays', () => {
  it('keeps the model line the learner answered after the script is edited', async () => {
    const script = await played();
    const edited = await S.saveScript(db, {
      id: script.id,
      version: script.version,
      title: 'Ở quán ăn',
      body: 'A: いらっしゃいませ。 | Xin mời vào.\nB: 三人です。 | Ba người.',
    });
    expect(edited.ok).toBe(true);

    const [row] = await R.listRoleplays(db);
    expect(row.turns).toEqual([
      {
        turn: 2,
        said: '二人です',
        ok: true,
        model: { japanese: '二人です。', translation: 'Hai người.' },
      },
    ]);
    // Nhập vai lại names the script as it is called now.
    expect(row).toMatchObject({ scriptTitle: 'Ở quán ăn', scriptExists: true });
  });

  it('keeps the saved title and model lines once the script is deleted', async () => {
    const script = await played();
    expect(await S.deleteScript(db, script.id)).toBe(true);

    const [row] = await R.listRoleplays(db);
    expect(row).toMatchObject({ scriptTitle: 'Ở nhà hàng', scriptExists: false });
    expect(row.turns[0].model).toEqual({ japanese: '二人です。', translation: 'Hai người.' });
  });
});
