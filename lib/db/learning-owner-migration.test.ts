import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

// Roadmap 7.1a: the owner migration adds a nullable userId to the eight learning tables and gives
// every existing row to the one learner. It must not change any other value, FSRS fields above all.
// Runs the real SQL on a database that already holds rows in every learning table.

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '..', '..', 'prisma', 'migrations');
const OWNER = '20261025230000_learning_owner';
const TABLES = [
  'Item',
  'SrsState',
  'ReviewLog',
  'Sentence',
  'Turn',
  'Group',
  'GroupMember',
  'Settings',
] as const;

const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((name) => statSync(path.join(MIGRATIONS_DIR, name)).isDirectory())
  .sort();
const sql = (name: string) =>
  readFileSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8');

let db: Database.Database;

function dbBeforeOwner(): Database.Database {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-owner-mig-')), 'test.db');
  const d = new Database(file);
  for (const name of migrations.filter((n) => n < OWNER)) d.exec(sql(name));
  d.pragma('foreign_keys = ON');
  return d;
}

function addUser(d: Database.Database, id: string, role: string | null, createdAt: string) {
  d.prepare(
    `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt, role)
     VALUES (?, ?, ?, 1, ?, ?, ?)`,
  ).run(id, id, `${id}@example.com`, createdAt, createdAt, role);
}

// One row in every learning table, with FSRS values that would show any rounding or reordering.
function seedLearning(d: Database.Database) {
  d.prepare(
    `INSERT INTO Item (id, kind, expression, reading, meaningVi, level, source, suspended, starred, createdAt)
     VALUES ('i1', 'GRAMMAR', '〜ばかりに', 'ばかりに', 'chỉ vì', 'N2', 'MCP', 0, 1, '2026-10-01T00:00:00.000+00:00')`,
  ).run();
  d.prepare(
    `INSERT INTO SrsState (id, itemId, due, stability, difficulty, scheduledDays, learningSteps, reps, lapses, state, lastReview)
     VALUES ('s1', 'i1', '2026-10-30T07:13:42.123+00:00', 12.3456789, 5.987654321, 9, 0, 4, 1, 2,
             '2026-10-21T07:13:42.123+00:00')`,
  ).run();
  d.prepare(
    `INSERT INTO Sentence (id, direction, sourceText, userAnswer, createdAt)
     VALUES ('se1', 'JA_VI', 'ちょっと遅れたばかりに', 'chỉ vì trễ', '2026-10-01T00:00:00.000+00:00')`,
  ).run();
  d.prepare(
    `INSERT INTO Turn (id, itemId, direction, ja, vi, status, rating, createdAt)
     VALUES ('t1', 'i1', 'JA_VI', '遅れたばかりに', 'chỉ vì trễ', 'graded', 3, '2026-10-02T00:00:00.000+00:00')`,
  ).run();
  d.prepare(
    `INSERT INTO ReviewLog (id, itemId, rating, state, role, due, stability, difficulty, reviewedAt, sentenceId, turnId, channel)
     VALUES ('r1', 'i1', 3, 2, 'TARGET', '2026-10-30T07:13:42.123+00:00', 12.3456789, 5.987654321,
             '2026-10-21T07:13:42.123+00:00', 'se1', 't1', 'mcp')`,
  ).run();
  d.prepare(
    `INSERT INTO "Group" (id, name, kind, createdAt, updatedAt)
     VALUES ('g1', 'N2 khó', 'mixed', '2026-10-03T00:00:00.000+00:00', '2026-10-03T00:00:00.000+00:00')`,
  ).run();
  d.prepare(
    `INSERT INTO GroupMember (groupId, itemId, addedAt) VALUES ('g1', 'i1', '2026-10-03T00:00:00.000+00:00')`,
  ).run();
  d.prepare(
    `INSERT INTO Settings (data, updatedAt) VALUES ('{"sessionGoal":20}', '2026-10-04T00:00:00.000+00:00')`,
  ).run();
}

const rowsOf = (d: Database.Database, table: string) =>
  d.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all() as Record<string, unknown>[];

afterEach(() => db?.close());

describe('learning owner migration', () => {
  it('gives every learning row to the one learner and changes nothing else', () => {
    db = dbBeforeOwner();
    addUser(db, 'thien', 'admin', '2026-08-01T00:00:00.000+00:00');
    seedLearning(db);
    const before = Object.fromEntries(TABLES.map((t) => [t, rowsOf(db, t)]));

    db.exec(sql(OWNER));

    for (const table of TABLES) {
      const after = rowsOf(db, table);
      expect(after, table).toEqual(before[table].map((row) => ({ ...row, userId: 'thien' })));
    }
    expect(db.pragma('foreign_key_check')).toEqual([]);
  });

  it('picks the admin account even when another account is older', () => {
    db = dbBeforeOwner();
    addUser(db, 'test-account', null, '2026-07-01T00:00:00.000+00:00');
    addUser(db, 'thien', 'admin', '2026-08-01T00:00:00.000+00:00');
    seedLearning(db);

    db.exec(sql(OWNER));

    for (const table of TABLES) {
      const owners = new Set(rowsOf(db, table).map((r) => r.userId));
      expect([...owners], table).toEqual(['thien']);
    }
  });

  it('leaves rows unowned on a database with no account yet', () => {
    db = dbBeforeOwner();
    seedLearning(db);

    db.exec(sql(OWNER));

    for (const table of TABLES) {
      expect(
        rowsOf(db, table).every((r) => r.userId === null),
        table,
      ).toBe(true);
    }
  });

  it('owns only the settings row the app reads, so the one-row-per-learner index holds', () => {
    db = dbBeforeOwner();
    addUser(db, 'thien', 'admin', '2026-08-01T00:00:00.000+00:00');
    db.prepare(
      `INSERT INTO Settings (data, updatedAt) VALUES ('{"a":1}', '2026-10-04T00:00:00.000+00:00')`,
    ).run();
    db.prepare(
      `INSERT INTO Settings (data, updatedAt) VALUES ('{"b":2}', '2026-10-05T00:00:00.000+00:00')`,
    ).run();

    db.exec(sql(OWNER));

    expect(db.prepare('SELECT data, userId FROM Settings ORDER BY id').all()).toEqual([
      { data: '{"a":1}', userId: 'thien' },
      { data: '{"b":2}', userId: null },
    ]);
    expect(() =>
      db.prepare(`UPDATE Settings SET userId = 'thien' WHERE userId IS NULL`).run(),
    ).toThrow(/UNIQUE/);
  });

  it("deleting an account deletes that account's learning rows", () => {
    db = dbBeforeOwner();
    addUser(db, 'thien', 'admin', '2026-08-01T00:00:00.000+00:00');
    seedLearning(db);
    db.exec(sql(OWNER));

    db.prepare(`DELETE FROM user WHERE id = 'thien'`).run();

    for (const table of TABLES) expect(rowsOf(db, table), table).toEqual([]);
  });
});
