// Study-groups DB-layer test (plan 2026-07-21-study-groups). Runs against a REAL throwaway SQLite DB
// (same harness as tenancy.test.ts): proves the kind-guard (vocab/grammar/mixed), many-to-many
// membership, idempotent adds, and — critically — that groups + memberships are tenant-isolated and
// the fail-closed guard now covers GroupMember. DATABASE_URL is set BEFORE lib/db is imported so the
// guarded singleton binds to the temp DB.

import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const projectRoot = path.resolve(import.meta.dirname, '..');
const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-groups-')), 'test.db');
const url = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.DATABASE_URL = url;
execSync('npx prisma db push --accept-data-loss', {
  cwd: projectRoot,
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'ignore',
});

type Practice = typeof import('@/lib/practice');
type Groups = typeof import('@/lib/groups');
type Db = typeof import('@/lib/db');
let P: Practice;
let G: Groups;
let prisma: Db['prisma'];

const USER_A = 'user-a';
const USER_B = 'user-b';

// item ids resolved in beforeAll
let aGrammarId = '';
let aVocabId = '';
let bGrammarId = '';

beforeAll(async () => {
  P = await import('@/lib/practice');
  G = await import('@/lib/groups');
  ({ prisma } = await import('@/lib/db'));

  await prisma.user.create({ data: { id: USER_A, name: USER_A, email: 'a@example.test' } });
  await prisma.user.create({ data: { id: USER_B, name: USER_B, email: 'b@example.test' } });

  await P.addItems(
    USER_A,
    [{ expression: 'AAA_grammar', meaningVi: 'ngữ pháp A' }],
    'MCP',
    'GRAMMAR',
  );
  await P.addItems(USER_A, [{ expression: 'AAA_vocab', meaningVi: 'từ vựng A' }], 'MCP', 'VOCAB');
  await P.addItems(
    USER_B,
    [{ expression: 'BBB_grammar', meaningVi: 'ngữ pháp B' }],
    'MCP',
    'GRAMMAR',
  );

  aGrammarId = (await P.listItems(USER_A, { kind: 'GRAMMAR' })).find(
    (i) => i.expression === 'AAA_grammar',
  )!.itemId;
  aVocabId = (await P.listItems(USER_A, { kind: 'VOCAB' })).find(
    (i) => i.expression === 'AAA_vocab',
  )!.itemId;
  bGrammarId = (await P.listItems(USER_B, { kind: 'GRAMMAR' })).find(
    (i) => i.expression === 'BBB_grammar',
  )!.itemId;
});

describe('study groups — CRUD + counts', () => {
  it('create + list: a new group is listed for its owner only, with a member count', async () => {
    const g = await G.createGroup(USER_A, { name: 'N5 て-form', kind: 'grammar' });
    expect(g.kind).toBe('grammar');
    expect(g.memberCount).toBe(0);

    const aGroups = await G.listGroups(USER_A);
    expect(aGroups.map((x) => x.name)).toContain('N5 て-form');
    expect(await G.listGroups(USER_B)).toHaveLength(0); // B sees nothing of A's
  });

  it('name is required', async () => {
    await expect(G.createGroup(USER_A, { name: '   ' })).rejects.toThrow(/name is required/i);
  });
});

describe('study groups — kind-guard', () => {
  it('a grammar group rejects a vocab item, accepts a grammar item', async () => {
    const g = await G.createGroup(USER_A, { name: 'grammar-only', kind: 'grammar' });
    await expect(G.addItemsToGroup(USER_A, g.id, [aVocabId])).rejects.toThrow(/does not accept/i);

    const res = await G.addItemsToGroup(USER_A, g.id, [aGrammarId]);
    expect(res.added).toBe(1);

    const detail = await G.getGroup(USER_A, g.id);
    expect(detail!.memberCount).toBe(1);
    expect(detail!.members.map((m) => m.itemId)).toEqual([aGrammarId]);
  });

  it('a mixed group accepts both grammar and vocab', async () => {
    const g = await G.createGroup(USER_A, { name: 'mixed-bag', kind: 'mixed' });
    const res = await G.addItemsToGroup(USER_A, g.id, [aGrammarId, aVocabId]);
    expect(res.added).toBe(2);
  });

  it('adding is idempotent (re-adding an existing member is a no-op)', async () => {
    const g = await G.createGroup(USER_A, { name: 'dupe-test', kind: 'mixed' });
    expect((await G.addItemsToGroup(USER_A, g.id, [aGrammarId])).added).toBe(1);
    expect((await G.addItemsToGroup(USER_A, g.id, [aGrammarId])).added).toBe(0);
  });
});

describe('study groups — tenant isolation', () => {
  it("B cannot add to A's group, nor add A's item — and A cannot add B's item", async () => {
    const g = await G.createGroup(USER_A, { name: 'A-owned', kind: 'mixed' });
    // B targeting A's group: not found in B's tenant.
    await expect(G.addItemsToGroup(USER_B, g.id, [bGrammarId])).rejects.toThrow(/not found/i);
    // A trying to pull B's item into A's group: item not in A's collection.
    await expect(G.addItemsToGroup(USER_A, g.id, [bGrammarId])).rejects.toThrow(
      /not found in your collection/i,
    );
  });

  it("getGroup returns null for another user's group; deleteGroup is scoped", async () => {
    const g = await G.createGroup(USER_A, { name: 'to-delete', kind: 'mixed' });
    await G.addItemsToGroup(USER_A, g.id, [aGrammarId]);

    expect(await G.getGroup(USER_B, g.id)).toBeNull();
    expect(await G.deleteGroup(USER_B, g.id)).toBe(false); // not B's → nothing deleted
    expect(await G.getGroup(USER_A, g.id)).not.toBeNull(); // survived

    expect(await G.deleteGroup(USER_A, g.id)).toBe(true); // owner deletes (cascade drops members)
    expect(await G.getGroup(USER_A, g.id)).toBeNull();
  });

  it('the fail-closed guard now covers GroupMember (unscoped query is rejected)', async () => {
    await expect(prisma.groupMember.findMany({})).rejects.toThrow(/Tenancy guard/);
    await expect(prisma.group.count({ where: {} })).rejects.toThrow(/Tenancy guard/);
  });

  it('removeItemsFromGroup drops only the named memberships', async () => {
    const g = await G.createGroup(USER_A, { name: 'remove-test', kind: 'mixed' });
    await G.addItemsToGroup(USER_A, g.id, [aGrammarId, aVocabId]);
    const res = await G.removeItemsFromGroup(USER_A, g.id, [aVocabId]);
    expect(res.removed).toBe(1);
    const detail = await G.getGroup(USER_A, g.id);
    expect(detail!.members.map((m) => m.itemId)).toEqual([aGrammarId]);
  });
});

describe('study groups — suggest_group dry-run (previewGroupMembers)', () => {
  it('splits proposed items into fit / mismatched / notFound, writing nothing', async () => {
    const preview = await G.previewGroupMembers(USER_A, 'grammar', [
      aGrammarId, // fits a grammar group
      aVocabId, // wrong kind for a grammar group
      'does-not-exist', // not the user's
    ]);
    expect(preview.fit.map((m) => m.itemId)).toEqual([aGrammarId]);
    expect(preview.mismatched.map((m) => m.itemId)).toEqual([aVocabId]);
    expect(preview.notFound).toEqual(['does-not-exist']);

    // Dry-run only — B's item is never revealed to A even when its id is passed.
    const cross = await G.previewGroupMembers(USER_A, 'mixed', [bGrammarId]);
    expect(cross.fit).toHaveLength(0);
    expect(cross.notFound).toEqual([bGrammarId]);
  });
});

describe('study groups — practice scoping (get_due_items { groupId })', () => {
  it('a group scopes the due batch to its grammar members; an empty group matches nothing', async () => {
    const g = await G.createGroup(USER_A, { name: 'focus-grp', kind: 'grammar' });
    const empty = await P.getDueBatch(USER_A, new Date(), undefined, { groupId: g.id });
    expect(empty.focus?.matched).toBe(0);

    await G.addItemsToGroup(USER_A, g.id, [aGrammarId]);
    const scoped = await P.getDueBatch(USER_A, new Date(), undefined, { groupId: g.id });
    expect(scoped.focus?.matched).toBe(1);
    expect(scoped.items.map((i) => i.id)).toContain(aGrammarId);
  });
});
