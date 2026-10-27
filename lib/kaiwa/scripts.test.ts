import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-kaiwa-scripts-');

type Scripts = typeof import('@/lib/kaiwa/scripts');
type Db = typeof import('@/lib/db/db');
let S: Scripts;
let prisma: Db['prisma'];
let mine: UserDb;
let theirs: UserDb;

const BODY = 'A: いらっしゃいませ。 | Xin mời vào.\nB: 二人です。 | Hai người.';

beforeAll(async () => {
  S = await import('@/lib/kaiwa/scripts');
  ({ prisma } = await import('@/lib/db/db'));
  const { userDb } = await import('@/lib/db/user-db');
  mine = userDb(await createTestUser(prisma, 'learner'));
  theirs = userDb(await createTestUser(prisma, 'other'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
});

async function created(db: UserDb = mine) {
  const saved = await S.saveScript(db, { title: ' Ở nhà hàng ', body: `${BODY}\r\n\r\n` });
  if (!saved.ok) throw new Error(saved.error);
  return saved.data;
}

describe('saveScript', () => {
  it('creates a script at version 1, title and body tidied', async () => {
    const script = await created();
    expect(script.version).toBe(1);
    const record = await S.getScript(mine, script.id);
    expect(record).toMatchObject({ title: 'Ở nhà hàng', body: BODY, userId: 'learner' });
  });

  it('refuses a malformed script and saves nothing', async () => {
    const saved = await S.saveScript(mine, { title: 'T', body: '# Tiêu đề\nA: はい。' });
    expect(saved).toEqual({ ok: false, error: expect.stringMatching(/^Dòng 1: /) });
    expect(await S.listScripts(mine)).toEqual([]);
  });

  it('replaces a script when the writer read the current version', async () => {
    const script = await created();
    const saved = await S.saveScript(mine, {
      id: script.id,
      version: 1,
      title: 'Ở nhà hàng 2',
      body: `${BODY}\nA: かしこまりました。`,
    });
    expect(saved.ok && saved.data.version).toBe(2);
    expect((await S.getScript(mine, script.id))?.title).toBe('Ở nhà hàng 2');
  });

  it('refuses a writer holding an older version, so newer work is kept', async () => {
    const script = await created();
    await S.saveScript(mine, { id: script.id, version: 1, title: 'Web', body: BODY });
    const stale = await S.saveScript(mine, { id: script.id, version: 1, title: 'AI', body: BODY });
    expect(stale).toEqual({ ok: false, error: expect.stringContaining('bản 1, nay là bản 2') });
    expect((await S.getScript(mine, script.id))?.title).toBe('Web');
  });

  it('asks for the version when replacing', async () => {
    const script = await created();
    const saved = await S.saveScript(mine, { id: script.id, title: 'T', body: BODY });
    expect(saved).toEqual({ ok: false, error: expect.stringContaining('Thiếu số phiên bản') });
  });

  it('stops at the script limit', async () => {
    await prisma.$executeRawUnsafe(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${S.MAX_SCRIPTS})
       INSERT INTO "Script" (id, userId, title, body, updatedAt)
       SELECT 's' || i, 'learner', 'T', 'A: はい。', CURRENT_TIMESTAMP FROM n`,
    );
    const saved = await S.saveScript(mine, { title: 'One more', body: BODY });
    expect(saved).toEqual({ ok: false, error: expect.stringContaining('200 kịch bản') });
  });
});

describe('one learner cannot reach another learner’s scripts', () => {
  it('hides them from list and get, and refuses to replace or delete them', async () => {
    const script = await created(theirs);
    expect(await S.listScripts(mine)).toEqual([]);
    expect(await S.getScript(mine, script.id)).toBeNull();
    const saved = await S.saveScript(mine, { id: script.id, version: 1, title: 'X', body: BODY });
    expect(saved).toEqual({ ok: false, error: expect.stringContaining('Không tìm thấy') });
    expect(await S.deleteScript(mine, script.id)).toBe(false);
    expect((await S.getScript(theirs, script.id))?.title).toBe('Ở nhà hàng');
  });
});

describe('listScripts and deleteScript', () => {
  it('lists newest first without bodies, and deletes', async () => {
    const first = await created();
    const second = await created();
    await S.saveScript(mine, { id: first.id, version: 1, title: 'Sửa', body: BODY });
    const list = await S.listScripts(mine);
    expect(list.map((s) => s.id)).toEqual([first.id, second.id]);
    expect(list[0]).not.toHaveProperty('body');
    expect(await S.deleteScript(mine, first.id)).toBe(true);
    expect((await S.listScripts(mine)).map((s) => s.id)).toEqual([second.id]);
  });
});
