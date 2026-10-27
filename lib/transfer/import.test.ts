import { describe, expect, it } from 'vitest';
import {
  buildTableMergeSql,
  itemKey,
  parseAccountBackup,
  planById,
  planItems,
  reconcileUsersByEmail,
  toDiff,
} from '@/lib/transfer/schema';

describe('parseAccountBackup', () => {
  it('accepts a minimal export and defaults every collection to empty', () => {
    const res = parseAccountBackup({ exportedAt: '2026-07-23T10:00:00Z', userId: 'u1' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.items).toEqual([]);
    expect(res.data.reviewLogs).toEqual([]);
    expect(res.data.settings).toBeFalsy(); // absent -> undefined; present-but-empty -> null
  });

  it('coerces ISO date strings back into Date objects', () => {
    const res = parseAccountBackup({
      items: [
        {
          id: 'i1',
          kind: 'VOCAB',
          expression: '猫',
          meaningVi: 'con mèo',
          createdAt: '2026-07-01T00:00:00Z',
        },
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.items[0].createdAt).toBeInstanceOf(Date);
    expect(res.data.items[0].level).toBe('N5'); // schema default applied
  });

  it('rejects a row missing a required field with a located message', () => {
    const res = parseAccountBackup({ items: [{ id: 'i1', kind: 'VOCAB' }] });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain('items.0.expression'); // first missing required field is reported
  });

  it('rejects a non-object payload', () => {
    expect(parseAccountBackup('not json').ok).toBe(false);
    expect(parseAccountBackup(42).ok).toBe(false);
  });

  it('keeps study groups and their memberships', () => {
    const res = parseAccountBackup({
      groups: [{ id: 'g1', name: 'Đi làm', kind: 'mixed', note: null, color: null }],
      groupMembers: [{ groupId: 'g1', itemId: 'i1', addedAt: '2026-08-01T00:00:00Z' }],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.groups).toHaveLength(1);
    expect(res.data.groups[0].name).toBe('Đi làm');
    expect(res.data.groupMembers[0].groupId).toBe('g1');
    expect(res.data.groupMembers[0].addedAt).toBeInstanceOf(Date);
  });

  it('keeps where an item or a group was taken from in the shared library (phase 8, L1b)', () => {
    const res = parseAccountBackup({
      items: [
        { id: 'i1', kind: 'VOCAB', expression: '店', meaningVi: 'cửa hàng', libraryEntryId: 'le1' },
      ],
      groups: [{ id: 'g1', name: 'N5 · Từ vựng', libraryEntryId: 'le2' }],
    });
    expect(res.ok && res.data.items[0].libraryEntryId).toBe('le1');
    expect(res.ok && res.data.groups[0].libraryEntryId).toBe('le2');
  });
});

describe('planById (upsert)', () => {
  it('creates ids that are new and updates ids that already exist', () => {
    const plan = planById(['a', 'b', 'c'], new Set(['b']), 'upsert');
    expect(plan.create).toEqual(['a', 'c']);
    expect(plan.update).toEqual(['b']);
    expect(plan.skip).toEqual([]);
  });

  it('acts on a duplicate id only once and skips the repeat', () => {
    const plan = planById(['a', 'a', 'b'], new Set(), 'upsert');
    expect(plan.create).toEqual(['a', 'b']);
    expect(plan.skip).toEqual(['a']);
  });
});

describe('planById (insert-only) — ReviewLog invariant #2', () => {
  it('never rewrites an existing id; it is skipped, not updated', () => {
    const plan = planById(['log1', 'log2'], new Set(['log1']), 'insert-only');
    expect(plan.create).toEqual(['log2']);
    expect(plan.update).toEqual([]);
    expect(plan.skip).toEqual(['log1']);
  });
});

describe('planItems', () => {
  const existingIds = new Set(['i1']);
  const existingKeys = new Map([
    [itemKey('VOCAB', '猫'), 'i1'],
    [itemKey('VOCAB', '犬'), 'i2'], // owned by a different id than any incoming row
  ]);

  it('updates a row whose id already exists', () => {
    const plan = planItems(
      [{ id: 'i1', kind: 'VOCAB', expression: '猫' }],
      existingIds,
      existingKeys,
    );
    expect(plan.update).toEqual(['i1']);
    expect(plan.create).toEqual([]);
  });

  it('creates a genuinely new row', () => {
    const plan = planItems(
      [{ id: 'iNew', kind: 'GRAMMAR', expression: '〜ばかりに' }],
      existingIds,
      existingKeys,
    );
    expect(plan.create).toEqual(['iNew']);
  });

  it('skips a new id whose (kind, expression) already belongs to another item', () => {
    const plan = planItems(
      [{ id: 'iDifferent', kind: 'VOCAB', expression: '犬' }],
      existingIds,
      existingKeys,
    );
    expect(plan.create).toEqual([]);
    expect(plan.skip).toEqual(['iDifferent']); // would violate @@unique([userId, kind, expression])
  });
});

describe('reconcileUsersByEmail — cross-machine identity (system sync)', () => {
  it('maps a same-email-different-id user to the local id (the collision case)', () => {
    const r = reconcileUsersByEmail(
      [{ id: 'BACKUP_ID', email: 'me@x.com' }],
      [{ id: 'LOCAL_ID', email: 'me@x.com' }],
    );
    expect(r.idMap.get('BACKUP_ID')).toBe('LOCAL_ID');
    expect(r.insertUserIds.has('BACKUP_ID')).toBe(false); // not re-inserted -> no @@unique(email) clash
  });

  it('flags a genuinely new email for insertion, keeping its own id', () => {
    const r = reconcileUsersByEmail(
      [{ id: 'NEW', email: 'new@x.com' }],
      [{ id: 'LOCAL', email: 'me@x.com' }],
    );
    expect(r.insertUserIds.has('NEW')).toBe(true);
    expect(r.idMap.has('NEW')).toBe(false);
  });

  it('matches email case- and space-insensitively', () => {
    const r = reconcileUsersByEmail(
      [{ id: 'B', email: '  Me@X.CoM ' }],
      [{ id: 'L', email: 'me@x.com' }],
    );
    expect(r.idMap.get('B')).toBe('L');
  });

  it('needs no map entry when the id already matches locally', () => {
    const r = reconcileUsersByEmail(
      [{ id: 'SAME', email: 'me@x.com' }],
      [{ id: 'SAME', email: 'me@x.com' }],
    );
    expect(r.idMap.size).toBe(0);
    expect(r.insertUserIds.size).toBe(0);
  });
});

describe('buildTableMergeSql — user-column translation + collision-proof merge', () => {
  it('translates a userId column through uidmap and copies others verbatim', () => {
    const sql = buildTableMergeSql({
      table: 'Item',
      cols: ['id', 'userId', 'expression'],
      userCols: ['userId'],
    });
    expect(sql).toContain('main."Item" ("id", "userId", "expression")');
    expect(sql).toContain(
      'COALESCE((SELECT new_id FROM uidmap WHERE old_id = b."userId"), b."userId")',
    );
    expect(sql).toContain('b."id"');
    expect(sql).toContain('b."expression"');
    expect(sql).toMatch(/^INSERT OR IGNORE INTO/); // skip-on-any-constraint -> never crashes on a unique
  });

  it("translates Comment's authorId (the user FK is not always named userId)", () => {
    const sql = buildTableMergeSql({
      table: 'Comment',
      cols: ['id', 'authorId'],
      userCols: ['authorId'],
    });
    expect(sql).toContain(
      'COALESCE((SELECT new_id FROM uidmap WHERE old_id = b."authorId"), b."authorId")',
    );
  });

  it('applies a backupWhere filter (e.g. only-new-email users)', () => {
    const sql = buildTableMergeSql({
      table: 'user',
      cols: ['id', 'email'],
      userCols: [],
      backupWhere: 'b."email" NOT IN (SELECT "email" FROM main."user")',
    });
    expect(sql).toContain('WHERE b."email" NOT IN (SELECT "email" FROM main."user")');
    expect(sql).not.toContain('uidmap'); // no user col to translate
  });
});

describe('toDiff', () => {
  it('summarizes a plan into per-table counts', () => {
    expect(toDiff('Mục', { create: ['a', 'b'], update: ['c'], skip: [] })).toEqual({
      table: 'Mục',
      create: 2,
      update: 1,
      skip: 0,
    });
  });
});
