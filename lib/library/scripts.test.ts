import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-library-scripts-');

type Db = typeof import('@/lib/db/db');
let prisma: Db['prisma'];
let L: typeof import('@/lib/library/scripts');
let K: typeof import('@/lib/kaiwa/scripts');
let S: typeof import('@/lib/library/shared');
let author: UserDb;
let taker: UserDb;

const BODY = 'A: いらっしゃいませ。 | Xin mời vào.\nB: 二人です。 | Hai người.';

async function written(db: UserDb, title = 'Ở nhà hàng', body = BODY) {
  const saved = await K.saveScript(db, { title, body });
  if (!saved.ok) throw new Error(saved.error);
  return saved.data;
}
async function shared(db: UserDb = author, title?: string, body?: string) {
  const script = await written(db, title, body);
  const res = await L.publishScript(db, script.id);
  if (!res.ok) throw new Error(res.error);
  return { script, entryId: res.data.entryId };
}
async function edit(db: UserDb, id: string, body: string) {
  const current = (await K.getScript(db, id))!;
  const saved = await K.saveScript(db, {
    id,
    version: current.version,
    title: current.title,
    body,
  });
  if (!saved.ok) throw new Error(saved.error);
}
const entry = (id: string) => prisma.libraryEntry.findUniqueOrThrow({ where: { id } });

beforeAll(async () => {
  ({ prisma } = await import('@/lib/db/db'));
  L = await import('@/lib/library/scripts');
  K = await import('@/lib/kaiwa/scripts');
  S = await import('@/lib/library/shared');
  const { userDb } = await import('@/lib/db/user-db');
  author = userDb(await createTestUser(prisma, 'author'));
  taker = userDb(await createTestUser(prisma, 'taker'));
});

beforeEach(async () => {
  await resetLearningData(prisma);
  await prisma.libraryEntry.deleteMany();
});

describe('planScriptShare', () => {
  const script = { title: 'Ở quán', body: BODY };
  const entryOf = (body: string, id = 'e') => ({ id, name: 'Ở quán', body });

  it('creates a share of its own, or one based on the edited copy it was taken from', async () => {
    const { planScriptShare } = await import('@/lib/library/script-share');
    expect(planScriptShare(script, null, null)).toEqual({ kind: 'create', basedOnId: null });
    expect(planScriptShare(script, entryOf('A: 他。 | Khác.'), null)).toEqual({
      kind: 'create',
      basedOnId: 'e',
    });
  });
  it('refuses an unedited copy, and a share the admin hid', async () => {
    const { planScriptShare } = await import('@/lib/library/script-share');
    expect(planScriptShare(script, entryOf(BODY), null).kind).toBe('same-as-source');
    expect(planScriptShare(script, null, entryOf(BODY, 'own'), true).kind).toBe('removed');
  });
  it('leaves an open share that says the same, and updates one that does not', async () => {
    const { planScriptShare } = await import('@/lib/library/script-share');
    expect(planScriptShare(script, null, entryOf(BODY, 'own'))).toEqual({
      kind: 'unchanged',
      entryId: 'own',
    });
    expect(planScriptShare(script, null, entryOf('A: 他。 | Khác.', 'own'))).toEqual({
      kind: 'update',
      entryId: 'own',
    });
  });
});

describe('publishScript', () => {
  it('shares the title and text as a script entry of its author', async () => {
    const { script, entryId } = await shared();
    expect(await entry(entryId)).toMatchObject({
      type: 'SCRIPT',
      name: 'Ở nhà hàng',
      body: BODY,
      origin: 'LEARNER',
      authorId: 'author',
      sourceId: script.id,
      basedOnId: null,
      status: 'public',
    });
  });

  it('keeps one share per script: sharing again updates it after an edit', async () => {
    const { script, entryId } = await shared();
    const again = await L.publishScript(author, script.id);
    expect(again).toEqual({ ok: true, data: { entryId, created: false } });

    const edited = 'A: こんばんは。 | Chào buổi tối.';
    await edit(author, script.id, edited);
    expect((await L.scriptShareStatus(author, script.id))?.shared).toMatchObject({
      entryId,
      changed: true,
    });
    // The share is a snapshot: it does not follow the edit until shared again.
    expect((await entry(entryId)).body).toBe(BODY);
    expect(await L.publishScript(author, script.id)).toEqual({
      ok: true,
      data: { entryId, created: false },
    });
    expect((await entry(entryId)).body).toBe(edited);
    expect(await prisma.libraryEntry.count()).toBe(1);
  });

  it("refuses another learner's script", async () => {
    const script = await written(author);
    const res = await L.publishScript(taker, script.id);
    expect(res.ok).toBe(false);
    expect(await L.scriptShareStatus(taker, script.id)).toBeNull();
    expect(await prisma.libraryEntry.count()).toBe(0);
  });

  it('takes a share down; whoever took it keeps their copy', async () => {
    const { script, entryId } = await shared();
    const took = await L.takeScript(taker, entryId);
    expect(took.ok).toBe(true);
    expect(await L.unpublishScript(author, script.id)).toEqual({ ok: true, data: { hidden: 1 } });
    expect((await entry(entryId)).status).toBe('hidden');
    expect(await L.listScriptEntries(prisma)).toEqual([]);
    expect(await L.getScriptEntry(prisma, entryId)).toBeNull();
    expect(await taker.script.count()).toBe(1);
    expect((await L.unpublishScript(author, script.id)).ok).toBe(false);
  });

  it('cannot share again what the admin hid', async () => {
    const M = await import('@/lib/library/moderation');
    const { script, entryId } = await shared();
    expect((await M.setEntryRemoved(prisma, entryId, true)).ok).toBe(true);
    const res = await L.publishScript(author, script.id);
    expect(res).toEqual({ ok: false, error: L.SCRIPT_REMOVED_BY_ADMIN });
    expect((await L.scriptShareStatus(author, script.id))?.blocked).toBe(L.SCRIPT_REMOVED_BY_ADMIN);
    expect((await L.takeScript(taker, entryId)).ok).toBe(false);
  });
});

describe('takeScript', () => {
  it("copies the script into the taker's Hội thoại once, with its furigana", async () => {
    const { entryId } = await shared();
    const took = await L.takeScript(taker, entryId);
    if (!took.ok) throw new Error(took.error);
    expect(took.data.already).toBe(false);
    const copy = await K.getScript(taker, took.data.scriptId);
    expect(copy).toMatchObject({
      title: 'Ở nhà hàng',
      body: BODY,
      version: 1,
      userId: 'taker',
      libraryEntryId: entryId,
    });
    expect(copy?.analysis).toBeTruthy();
    expect((await entry(entryId)).takeCount).toBe(1);

    const again = await L.takeScript(taker, entryId);
    expect(again).toEqual({ ok: true, data: { scriptId: took.data.scriptId, already: true } });
    expect(await taker.script.count()).toBe(1);
    expect((await entry(entryId)).takeCount).toBe(1);
  });

  it('opens the author their own script instead of copying their share', async () => {
    const { script, entryId } = await shared();
    expect(await L.takeScript(author, entryId)).toEqual({
      ok: true,
      data: { scriptId: script.id, already: true },
    });
    expect(await author.script.count()).toBe(1);
  });

  it('a taken copy is shared only once edited, based on the entry it came from', async () => {
    const { entryId } = await shared();
    const took = await L.takeScript(taker, entryId);
    if (!took.ok) throw new Error(took.error);
    const scriptId = took.data.scriptId;
    expect(await L.publishScript(taker, scriptId)).toEqual({
      ok: false,
      error: L.SCRIPT_SAME_AS_SOURCE,
    });
    expect(await L.scriptShareStatus(taker, scriptId)).toEqual({
      shared: null,
      basedOn: { entryId, status: 'public' },
      blocked: L.SCRIPT_SAME_AS_SOURCE,
    });

    await edit(taker, scriptId, `${BODY}\nA: どうぞ。 | Mời.`);
    const res = await L.publishScript(taker, scriptId);
    if (!res.ok) throw new Error(res.error);
    expect(await entry(res.data.entryId)).toMatchObject({
      authorId: 'taker',
      basedOnId: entryId,
    });
  });

  it('refuses an entry that is not a shared script', async () => {
    const group = await prisma.libraryEntry.create({
      data: { type: 'GROUP', name: 'N5', origin: 'LEARNER' },
    });
    expect((await L.takeScript(taker, group.id)).ok).toBe(false);
    expect((await L.takeScript(taker, 'nope')).ok).toBe(false);
    expect(await taker.script.count()).toBe(0);
  });
});

describe('listScriptEntries', () => {
  it('lists shared scripts with who shared them, searching title and text', async () => {
    await shared(author, 'Ở nhà hàng');
    await shared(taker, 'Ở ga', 'A: 切符をください。 | Cho tôi vé.');
    const all = await L.listScriptEntries(prisma);
    expect(all.map((s) => s.title).sort()).toEqual(['Ở ga', 'Ở nhà hàng']);
    expect(all.find((s) => s.title === 'Ở nhà hàng')).toMatchObject({
      author: 'author',
      lineCount: 2,
      speakers: ['A', 'B'],
      likes: 0,
      takeCount: 0,
    });
    expect((await L.listScriptEntries(prisma, { text: 'ga' })).map((s) => s.title)).toEqual([
      'Ở ga',
    ]);
    expect((await L.listScriptEntries(prisma, { text: '切符' })).map((s) => s.title)).toEqual([
      'Ở ga',
    ]);
  });

  it('ranks the most taken first and leaves scripts out of the item search', async () => {
    await shared(author, 'Ít người lấy');
    const { entryId } = await shared(author, 'Nhiều người lấy', 'A: はい。 | Vâng.');
    await L.takeScript(taker, entryId);
    expect((await L.listScriptEntries(prisma)).map((s) => s.title)).toEqual([
      'Nhiều người lấy',
      'Ít người lấy',
    ]);
    expect(await S.searchEntries(prisma, {})).toEqual([]);
    expect(await S.listGroupEntries(prisma)).toEqual([]);
  });

  it('marks which shared scripts the learner has a copy of', async () => {
    const mine = await shared(author, 'Của tôi');
    const theirs = await shared(taker, 'Của bạn', 'A: はい。 | Vâng.');
    const took = await L.takeScript(author, theirs.entryId);
    if (!took.ok) throw new Error(took.error);
    const rows = await L.listScriptEntries(prisma);
    const copies = await L.scriptCopies(author, rows);
    expect(copies.get(mine.entryId)).toBe(mine.script.id);
    expect(copies.get(theirs.entryId)).toBe(took.data.scriptId);
  });

  it('a like on a shared script counts like any entry', async () => {
    const likes = await import('@/lib/library/likes');
    const { entryId } = await shared();
    expect(await likes.setLike(taker, entryId, true)).toEqual({
      ok: true,
      data: { liked: true, likes: 1 },
    });
    expect((await L.getScriptEntry(prisma, entryId))?.likes).toBe(1);
  });
});
