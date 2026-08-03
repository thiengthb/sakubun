// Public-library + fork test (Phase 3). Real throwaway SQLite (same harness as tenancy/groups tests).
// Proves the sharing boundary: the library shows OTHERS' PUBLIC items, content ONLY (never SrsState/
// ReviewLog), never your own or private items; fork copies content into a fresh-scheduled item the
// taker owns, with a provenance link, and is dup-guarded. DATABASE_URL is set BEFORE lib/db imports.

import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-library-')), 'test.db');
const url = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = url;
execSync('npx prisma db push --accept-data-loss', {
  cwd: projectRoot,
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'ignore',
});

type Practice = typeof import('@/lib/practice');
type Library = typeof import('@/lib/library');
type Db = typeof import('@/lib/db');
let P: Practice;
let L: Library;
let prisma: Db['prisma'];

const USER_A = 'user-a';
const USER_B = 'user-b';

let aGrammarId = '';
let aPrivateId = '';
let aVocabId = '';

beforeAll(async () => {
  P = await import('@/lib/practice');
  L = await import('@/lib/library');
  ({ prisma } = await import('@/lib/db'));

  await prisma.user.create({ data: { id: USER_A, name: 'Akira', email: 'a@example.test' } });
  await prisma.user.create({ data: { id: USER_B, name: 'Bình', email: 'b@example.test' } });

  await P.addItems(
    USER_A,
    [{ expression: 'A_grammar', meaningVi: 'ngữ pháp A' }],
    'MCP',
    'GRAMMAR',
  );
  await P.addItems(USER_A, [{ expression: 'A_private', meaningVi: 'riêng A' }], 'MCP', 'GRAMMAR');
  await P.addItems(USER_A, [{ expression: 'A_vocab', meaningVi: 'từ A' }], 'MCP', 'VOCAB');

  aGrammarId = (await P.listItems(USER_A, { kind: 'GRAMMAR' })).find(
    (i) => i.expression === 'A_grammar',
  )!.itemId;
  aPrivateId = (await P.listItems(USER_A, { kind: 'GRAMMAR' })).find(
    (i) => i.expression === 'A_private',
  )!.itemId;
  aVocabId = (await P.listItems(USER_A, { kind: 'VOCAB' })).find(
    (i) => i.expression === 'A_vocab',
  )!.itemId;

  // A publishes the grammar item and the vocab item; A_private stays private.
  await L.publishItem(USER_A, aGrammarId);
  await L.publishItem(USER_A, aVocabId);
});

describe('public library — read boundary', () => {
  it('shows OTHERS public items with attribution + fork count, content ONLY (no schedule/history)', async () => {
    const forB = await L.listPublicLibrary(USER_B);
    const exprs = forB.map((e) => e.expression).sort();
    expect(exprs).toEqual(['A_grammar', 'A_vocab']); // both of A's PUBLIC items, not A_private
    const g = forB.find((e) => e.expression === 'A_grammar')!;
    expect(g.ownerName).toBe('Akira');
    expect(g.forkCount).toBe(0);
    expect(g.alreadyMine).toBe(false);
    // Content-only: the entry must NOT carry any FSRS/schedule/history field.
    for (const leak of [
      'srs',
      'due',
      'stability',
      'difficulty',
      'reps',
      'lapses',
      'reviews',
      'userId',
    ]) {
      expect(g).not.toHaveProperty(leak);
    }
  });

  it('lists your OWN shared items too, flagged isMine (so you can see what you published)', async () => {
    const forA = await L.listPublicLibrary(USER_A);
    expect(forA.map((e) => e.expression).sort()).toEqual(['A_grammar', 'A_vocab']); // A's PUBLIC pair
    for (const e of forA) {
      expect(e.isMine).toBe(true); // your own row — shown, not fork-able
      expect(e.alreadyMine).toBe(true); // you already own it by (kind, expression)
    }
    expect(forA.some((e) => e.expression === 'A_private')).toBe(false); // private stays out
  });

  it('a private item is never in the library, and getPublicItem returns null for it', async () => {
    expect(await L.getPublicItem(aPrivateId)).toBeNull();
    const forB = await L.listPublicLibrary(USER_B);
    expect(forB.some((e) => e.expression === 'A_private')).toBe(false);
  });

  it('filters by kind and search', async () => {
    expect((await L.listPublicLibrary(USER_B, { kind: 'VOCAB' })).map((e) => e.expression)).toEqual(
      ['A_vocab'],
    );
    expect(
      (await L.listPublicLibrary(USER_B, { search: 'grammar' })).map((e) => e.expression),
    ).toEqual(['A_grammar']);
  });

  it('unpublish removes an item from the library', async () => {
    expect(await L.unpublishItem(USER_A, aVocabId)).toBe(true);
    expect((await L.listPublicLibrary(USER_B)).map((e) => e.expression)).toEqual(['A_grammar']);
    await L.publishItem(USER_A, aVocabId); // restore for later tests
  });

  it('publish/unpublish is scoped — B cannot publish A item', async () => {
    expect(await L.publishItem(USER_B, aPrivateId)).toBe(false); // not B's
    expect(await L.getPublicItem(aPrivateId)).toBeNull(); // still private
  });
});

describe('public library — fork', () => {
  it('B forks A grammar: a NEW item B owns, fresh FSRS schedule, provenance link; source untouched', async () => {
    const res = await L.forkItem(USER_B, aGrammarId);
    expect(res.forked).toBe(true);
    const newId = (res as { forked: true; itemId: string }).itemId;

    const bItem = await prisma.item.findFirst({
      where: { userId: USER_B, id: newId },
      include: { srs: true },
    });
    expect(bItem!.expression).toBe('A_grammar');
    expect(bItem!.forkedFromId).toBe(aGrammarId);
    expect(bItem!.visibility).toBe('private'); // a fork is private by default
    expect(bItem!.srs).not.toBeNull(); // fresh schedule created
    expect(bItem!.srs!.state).toBe(0); // brand-new card, never reviewed

    // The source item and its owner's schedule are untouched — the fork has its own SrsState.
    expect(bItem!.srs!.itemId).toBe(newId);
    expect(bItem!.srs!.itemId).not.toBe(aGrammarId);

    // The library now reports the fork count and flags it as already-mine for B.
    const g = (await L.listPublicLibrary(USER_B)).find((e) => e.expression === 'A_grammar')!;
    expect(g.forkCount).toBe(1);
    expect(g.alreadyMine).toBe(true);
  });

  it('dup-guard: forking the same source again does nothing', async () => {
    const res = await L.forkItem(USER_B, aGrammarId);
    expect(res).toEqual({ forked: false, reason: 'already-have' });
  });

  it('cannot fork your OWN item, or a private/nonexistent one', async () => {
    expect(await L.forkItem(USER_A, aGrammarId)).toEqual({ forked: false, reason: 'own-item' });
    expect(await L.forkItem(USER_B, aPrivateId)).toEqual({ forked: false, reason: 'not-found' });
    expect(await L.forkItem(USER_B, 'nope')).toEqual({ forked: false, reason: 'not-found' });
  });
});

describe('public library — likes (Phase 5)', () => {
  it('like only a public item; count + likedByMe reflect it per viewer', async () => {
    expect(await L.toggleItemLike(USER_B, aPrivateId)).toBeNull(); // private → can't like
    expect(await L.toggleItemLike(USER_B, aGrammarId)).toEqual({ liked: true, count: 1 });

    const forB = (await L.listPublicLibrary(USER_B, { kind: 'GRAMMAR' })).find(
      (e) => e.id === aGrammarId,
    )!;
    expect(forB.likeCount).toBe(1);
    expect(forB.likedByMe).toBe(true);

    // The owner (A) sees the count but hasn't liked it themselves.
    const forA = (await L.listPublicLibrary(USER_A, { kind: 'GRAMMAR' })).find(
      (e) => e.id === aGrammarId,
    )!;
    expect(forA.likeCount).toBe(1);
    expect(forA.likedByMe).toBe(false);

    expect(await L.toggleItemLike(USER_B, aGrammarId)).toEqual({ liked: false, count: 0 }); // toggle off
  });
});
