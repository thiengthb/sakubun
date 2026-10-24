import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

// Roadmap 5.2 drops three v1 tables and three columns. SQLite drops a column by rebuilding the
// table, so Item (the parent of every learning row) is copied and replaced: this runs the real SQL
// on a database holding a row in every child table and checks that nothing else changed.

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '..', '..', 'prisma', 'migrations');
const DROP = '20261024100000_drop_v1_tables';

const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((name) => statSync(path.join(MIGRATIONS_DIR, name)).isDirectory())
  .sort();
const sql = (name: string) =>
  readFileSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8');

const KEPT = ['Item', 'SrsState', 'ReviewLog', 'Sentence', 'Turn', 'Group', 'GroupMember'];
const DROPPED_COLUMNS: Record<string, string[]> = {
  Item: ['challenge', 'challengeObservations'],
  Sentence: ['extraPatterns'],
};

let db: Database.Database;

function dbBeforeDrop(): Database.Database {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-drop-v1-')), 'test.db');
  const d = new Database(file);
  for (const name of migrations.filter((n) => n < DROP)) d.exec(sql(name));
  d.pragma('foreign_keys = ON');
  return d;
}

function seed(d: Database.Database) {
  const t = '2026-10-01T00:00:00.000+00:00';
  d.exec(`
    INSERT INTO Item (id, kind, expression, reading, hanviet, meaningVi, level, source, captureReason,
                      suspended, starred, enrichment, enrichedAt, createdAt, challenge, challengeObservations)
    VALUES ('i1', 'VOCAB', '猫', 'ねこ', 'MIÊU', 'mèo', 'N5', 'OPENJLPT', 'unknown', 0, 1, '{"v":5}', '${t}', '${t}', 1.5, 3),
           ('i2', 'GRAMMAR', '〜ばかりに', NULL, NULL, 'chỉ vì', 'N2', 'MCP', NULL, 1, 0, NULL, NULL, '${t}', NULL, 0);
    INSERT INTO SrsState (id, itemId, due, stability, difficulty, reps, lapses, state, lastReview)
    VALUES ('s1', 'i1', '${t}', 4.2, 5.1, 3, 1, 2, '${t}'), ('s2', 'i2', '${t}', 0, 0, 0, 0, 0, NULL);
    INSERT INTO Sentence (id, direction, sourceText, userAnswer, suggested, score, stagedItems, extraPatterns, status, createdAt)
    VALUES ('se1', 'JA_VI', '猫がいる', 'có con mèo', 'Có một con mèo.', 90, '["i1"]', '["〜がいる"]', 'GRADED', '${t}');
    INSERT INTO Turn (id, itemId, direction, ja, vi, status, answer, rating, createdAt)
    VALUES ('t1', 'i2', 'VI_JA', '遅れたばかりに', 'chỉ vì trễ', 'graded', '遅れたばかりに', 3, '${t}');
    INSERT INTO ReviewLog (id, itemId, rating, state, role, errorTags, due, stability, difficulty, reviewedAt, sentenceId, turnId, channel)
    VALUES ('r1', 'i1', 3, 2, 'TARGET', '["particle"]', '${t}', 4.2, 5.1, '${t}', 'se1', NULL, NULL),
           ('r2', 'i2', 3, 1, 'TARGET', NULL, '${t}', 1, 5, '${t}', NULL, 't1', 'mcp');
    INSERT INTO "Group" (id, name, kind, createdAt, updatedAt) VALUES ('g1', 'Động vật', 'VOCAB', '${t}', '${t}');
    INSERT INTO GroupMember (groupId, itemId, addedAt) VALUES ('g1', 'i1', '${t}');
    INSERT INTO LearnerNote (id, text, evidence, expiresAt) VALUES ('n1', 'Hay nhầm に và で', '[]', '${t}');
    INSERT INTO LearnerAbility (id, updatedAt) VALUES ('singleton', '${t}');
    INSERT INTO CalibrationProposal (id, target, direction, fromValue, toValue, axis, measured, ability, observations, reason)
    VALUES ('c1', 'length', 'JA_VI', 'short', 'medium', 'receptive', 0.9, 1100, 12, 'đủ dữ liệu');
  `);
}

function snapshot(d: Database.Database): Record<string, Record<string, unknown>[]> {
  return Object.fromEntries(
    KEPT.map((t) => [t, d.prepare(`SELECT * FROM "${t}" ORDER BY rowid`).all()]),
  ) as Record<string, Record<string, unknown>[]>;
}

const withoutDropped = (table: string, rows: Record<string, unknown>[]) =>
  rows.map((r) =>
    Object.fromEntries(
      Object.entries(r).filter(([k]) => !(DROPPED_COLUMNS[table] ?? []).includes(k)),
    ),
  );

const tablesOf = (d: Database.Database) =>
  (
    d.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]
  ).map((r) => r.name);

afterEach(() => db?.close());

describe('drop v1 tables migration', () => {
  it('keeps every value of every learning row except the dropped columns', () => {
    db = dbBeforeDrop();
    seed(db);
    const before = snapshot(db);

    db.exec(sql(DROP));

    const after = snapshot(db);
    for (const t of KEPT) expect(after[t], t).toEqual(withoutDropped(t, before[t]));
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('removes the three v1 tables and the three columns, nothing more', () => {
    db = dbBeforeDrop();
    const tablesBefore = tablesOf(db);
    db.exec(sql(DROP));

    expect(tablesOf(db).sort()).toEqual(
      tablesBefore
        .filter((t) => !['LearnerNote', 'LearnerAbility', 'CalibrationProposal'].includes(t))
        .sort(),
    );
    for (const [table, cols] of Object.entries(DROPPED_COLUMNS)) {
      const live = (db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map(
        (c) => c.name,
      );
      for (const c of cols) expect(live, `${table}.${c}`).not.toContain(c);
    }
  });

  it('cascades still work after Item is rebuilt', () => {
    db = dbBeforeDrop();
    seed(db);
    db.exec(sql(DROP));

    db.prepare(`DELETE FROM Item WHERE id = 'i1'`).run();
    expect(db.prepare(`SELECT COUNT(*) AS n FROM SrsState WHERE itemId = 'i1'`).get()).toEqual({
      n: 0,
    });
    expect(db.prepare(`SELECT COUNT(*) AS n FROM GroupMember`).get()).toEqual({ n: 0 });
    expect(db.prepare(`SELECT itemId FROM ReviewLog WHERE id = 'r1'`).get()).toEqual({
      itemId: null,
    });
  });
});
