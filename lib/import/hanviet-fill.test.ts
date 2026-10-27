import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';
import { hanvietFillSql } from './hanviet-fill';

describe('hanvietFillSql', () => {
  it('điền từ trước đây trống, sửa từ có âm cũ đổi khác, không bao giờ xoá âm', () => {
    const sql = hanvietFillSql(
      [
        { id: 'a', kind: 'VOCAB', hanviet: null },
        { id: 'b', kind: 'VOCAB', hanviet: 'NHẤT' },
        { id: 'g', kind: 'GRAMMAR', hanviet: null },
        { id: 'c', kind: 'VOCAB', hanviet: null },
        { id: 'd', kind: 'VOCAB', hanviet: 'NGÂN HÀNH' },
        { id: 'e', kind: 'VOCAB', hanviet: 'TRIỀU' },
      ],
      [
        { id: 'a', kind: 'VOCAB', hanviet: 'KHÍ' },
        { id: 'b', kind: 'VOCAB', hanviet: 'NHẤT' },
        { id: 'g', kind: 'GRAMMAR', hanviet: 'X' },
        { id: 'c', kind: 'VOCAB', hanviet: null },
        { id: 'new', kind: 'VOCAB', hanviet: 'TÂN' },
        { id: 'd', kind: 'VOCAB', hanviet: 'NGÂN HÀNG' },
        { id: 'e', kind: 'VOCAB', hanviet: null },
      ],
    );
    expect(sql.split('\n')).toEqual([
      `UPDATE "Item" SET "hanviet" = 'KHÍ' WHERE "id" = 'a' AND "source" = 'OPENJLPT' AND "hanviet" IS NULL;`,
      `UPDATE "Item" SET "hanviet" = 'NGÂN HÀNG' WHERE "id" = 'd' AND "source" = 'OPENJLPT' AND "hanviet" = 'NGÂN HÀNH';`,
    ]);
  });

  it('trên DB thật: điền ô trống, sửa âm máy ghi, không đè âm người học đã sửa, bỏ qua mục tự thêm', () => {
    const url = createTestDb('hanviet-fill-');
    const db = new Database(url.replace(/^file:/, ''));
    db.prepare(
      `INSERT INTO "user" ("id", "name", "email", "updatedAt") VALUES ('learner', 'learner', 'l@example.test', 0)`,
    ).run();
    const insert = db.prepare(
      `INSERT INTO "Item" ("id", "userId", "kind", "expression", "hanviet", "meaningVi", "source") VALUES (?, 'learner', 'VOCAB', ?, ?, 'x', ?)`,
    );
    insert.run('empty', '気分', null, 'OPENJLPT');
    insert.run('edited', '年', 'NIÊN (sửa)', 'OPENJLPT');
    insert.run('manual', '実', null, 'MANUAL');
    insert.run('machine', '銀行', 'NGÂN HÀNH', 'OPENJLPT');
    insert.run('learner', '社長', 'XÃ TRƯỞNG (tự sửa)', 'OPENJLPT');
    const rows = [
      ...['empty', 'edited', 'manual'].map((id) => ({ id, kind: 'VOCAB', hanviet: null })),
      { id: 'machine', kind: 'VOCAB', hanviet: 'NGÂN HÀNH' },
      { id: 'learner', kind: 'VOCAB', hanviet: 'XÃ TRƯỜNG' },
    ];
    db.exec(
      hanvietFillSql(rows, [
        { id: 'empty', kind: 'VOCAB', hanviet: 'KHÍ PHÂN' },
        { id: 'edited', kind: 'VOCAB', hanviet: 'NIÊN' },
        { id: 'manual', kind: 'VOCAB', hanviet: 'THỰC' },
        { id: 'machine', kind: 'VOCAB', hanviet: 'NGÂN HÀNG' },
        { id: 'learner', kind: 'VOCAB', hanviet: 'XÃ TRƯỞNG' },
      ]),
    );
    const got = Object.fromEntries(
      (
        db.prepare(`SELECT "id", "hanviet" FROM "Item"`).all() as {
          id: string;
          hanviet: string | null;
        }[]
      ).map((r) => [r.id, r.hanviet]),
    );
    db.close();
    expect(got).toEqual({
      empty: 'KHÍ PHÂN',
      edited: 'NIÊN (sửa)',
      manual: null,
      machine: 'NGÂN HÀNG',
      learner: 'XÃ TRƯỞNG (tự sửa)',
    });
  });
});
