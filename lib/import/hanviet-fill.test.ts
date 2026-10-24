import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';
import { hanvietFillSql } from './hanviet-fill';

describe('hanvietFillSql', () => {
  it('chỉ điền từ vựng trước đây trống mà nay đã có âm', () => {
    const sql = hanvietFillSql(
      [
        { id: 'a', kind: 'VOCAB', hanviet: null },
        { id: 'b', kind: 'VOCAB', hanviet: 'NHẤT' },
        { id: 'g', kind: 'GRAMMAR', hanviet: null },
        { id: 'c', kind: 'VOCAB', hanviet: null },
      ],
      [
        { id: 'a', kind: 'VOCAB', hanviet: 'KHÍ' },
        { id: 'b', kind: 'VOCAB', hanviet: 'NHẤT' },
        { id: 'g', kind: 'GRAMMAR', hanviet: 'X' },
        { id: 'c', kind: 'VOCAB', hanviet: null },
        { id: 'new', kind: 'VOCAB', hanviet: 'TÂN' },
      ],
    );
    expect(sql.split('\n')).toEqual([
      `UPDATE "Item" SET "hanviet" = 'KHÍ' WHERE "id" = 'a' AND "source" = 'OPENJLPT' AND "hanviet" IS NULL;`,
    ]);
  });

  it('trên DB thật: điền ô trống, không đè âm người học đã sửa, bỏ qua mục tự thêm', () => {
    const url = createTestDb('hanviet-fill-');
    const db = new Database(url.replace(/^file:/, ''));
    const insert = db.prepare(
      `INSERT INTO "Item" ("id", "kind", "expression", "hanviet", "meaningVi", "source") VALUES (?, 'VOCAB', ?, ?, 'x', ?)`,
    );
    insert.run('empty', '気分', null, 'OPENJLPT');
    insert.run('edited', '年', 'NIÊN (sửa)', 'OPENJLPT');
    insert.run('manual', '実', null, 'MANUAL');
    const rows = ['empty', 'edited', 'manual'].map((id) => ({ id, kind: 'VOCAB', hanviet: null }));
    db.exec(
      hanvietFillSql(rows, [
        { id: 'empty', kind: 'VOCAB', hanviet: 'KHÍ PHÂN' },
        { id: 'edited', kind: 'VOCAB', hanviet: 'NIÊN' },
        { id: 'manual', kind: 'VOCAB', hanviet: 'THỰC' },
      ]),
    );
    const got = Object.fromEntries(
      (db.prepare(`SELECT "id", "hanviet" FROM "Item"`).all() as { id: string; hanviet: string | null }[]).map(
        (r) => [r.id, r.hanviet],
      ),
    );
    db.close();
    expect(got).toEqual({ empty: 'KHÍ PHÂN', edited: 'NIÊN (sửa)', manual: null });
  });

});
