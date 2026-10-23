import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

// The Turn migration must leave existing review history untouched: it only adds a table and two
// nullable columns. Runs the real SQL on a database that already holds pre-v2 rows.

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '..', '..', 'prisma', 'migrations');
const TURN = '20261023123637_turn';

const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((name) => statSync(path.join(MIGRATIONS_DIR, name)).isDirectory())
  .sort();
const sql = (name: string) =>
  readFileSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8');

let db: Database.Database;

function dbBeforeTurn(): Database.Database {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-turn-mig-')), 'test.db');
  const d = new Database(file);
  for (const name of migrations.filter((n) => n < TURN)) d.exec(sql(name));
  d.pragma('foreign_keys = ON');
  return d;
}

function seedPreV2(d: Database.Database) {
  d.prepare(
    `INSERT INTO Item (id, kind, expression, meaningVi, level, source, createdAt, challengeObservations)
     VALUES ('i1', 'GRAMMAR', '〜ばかりに', 'chỉ vì', 'N2', 'MCP', '2026-10-01T00:00:00.000+00:00', 0)`,
  ).run();
  d.prepare(
    `INSERT INTO Sentence (id, direction, sourceText, userAnswer, createdAt)
     VALUES ('s1', 'JA_VI', 'ちょっと遅れたばかりに', 'chỉ vì trễ', '2026-10-01T00:00:00.000+00:00')`,
  ).run();
  d.prepare(
    `INSERT INTO ReviewLog (id, itemId, rating, state, role, due, stability, difficulty, reviewedAt, sentenceId)
     VALUES ('r1', 'i1', 3, 0, 'TARGET', '2026-10-02T00:00:00.000+00:00', 1.5, 5.2,
             '2026-10-01T00:00:00.000+00:00', 's1')`,
  ).run();
}

afterEach(() => db?.close());

describe('Turn migration', () => {
  it('keeps every existing review row and leaves the new columns null', () => {
    db = dbBeforeTurn();
    seedPreV2(db);
    const before = db.prepare('SELECT * FROM ReviewLog').all();

    db.exec(sql(TURN));

    const after = db.prepare('SELECT * FROM ReviewLog').all() as Record<string, unknown>[];
    expect(after).toHaveLength(1);
    expect(after[0]).toEqual({ ...(before[0] as object), turnId: null, channel: null });
  });

  it('links a review to its turn, and deleting either side never deletes history', () => {
    db = dbBeforeTurn();
    seedPreV2(db);
    db.exec(sql(TURN));

    db.prepare(
      `INSERT INTO Turn (id, itemId, direction, ja, vi) VALUES ('t1', 'i1', 'JA_VI', '遅れたばかりに', 'chỉ vì trễ')`,
    ).run();
    expect(db.prepare('SELECT status, hinted FROM Turn').get()).toEqual({
      status: 'staged',
      hinted: 0,
    });
    db.prepare(`UPDATE ReviewLog SET turnId = 't1', channel = 'mcp' WHERE id = 'r1'`).run();

    db.prepare(`DELETE FROM Item WHERE id = 'i1'`).run();
    expect(db.prepare('SELECT itemId FROM Turn').get()).toEqual({ itemId: null });

    db.prepare(`DELETE FROM Turn WHERE id = 't1'`).run();
    expect(db.prepare('SELECT itemId, turnId, channel FROM ReviewLog').get()).toEqual({
      itemId: null,
      turnId: null,
      channel: 'mcp',
    });
  });
});
