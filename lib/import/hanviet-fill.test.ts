import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/db/test-db';
import { hanvietFillSql } from './hanviet-fill';

describe('hanvietFillSql', () => {
  it('điền từ trước đây trống, sửa từ có âm cũ đổi khác, không bao giờ xoá âm', () => {
    const sql = hanvietFillSql(
      [
        { id: 'a', kind: 'VOCAB', expression: 'a', hanviet: null },
        { id: 'b', kind: 'VOCAB', expression: 'b', hanviet: 'NHẤT' },
        { id: 'g', kind: 'GRAMMAR', expression: 'g', hanviet: null },
        { id: 'c', kind: 'VOCAB', expression: 'c', hanviet: null },
        { id: 'd', kind: 'VOCAB', expression: 'd', hanviet: 'NGÂN HÀNH' },
        { id: 'e', kind: 'VOCAB', expression: 'e', hanviet: 'TRIỀU' },
      ],
      [
        { id: 'a', kind: 'VOCAB', expression: 'a', hanviet: 'KHÍ' },
        { id: 'b', kind: 'VOCAB', expression: 'b', hanviet: 'NHẤT' },
        { id: 'g', kind: 'GRAMMAR', expression: 'g', hanviet: 'X' },
        { id: 'c', kind: 'VOCAB', expression: 'c', hanviet: null },
        { id: 'new', kind: 'VOCAB', expression: 'new', hanviet: 'TÂN' },
        { id: 'd', kind: 'VOCAB', expression: 'd', hanviet: 'NGÂN HÀNG' },
        { id: 'e', kind: 'VOCAB', expression: 'e', hanviet: null },
      ],
    );
    expect(sql.split('\n')).toEqual([
      `UPDATE "Item" SET "hanviet" = 'KHÍ' WHERE "kind" = 'VOCAB' AND "expression" = 'a' AND "source" = 'OPENJLPT' AND "hanviet" IS NULL;`,
      `UPDATE "Item" SET "hanviet" = 'NGÂN HÀNG' WHERE "kind" = 'VOCAB' AND "expression" = 'd' AND "source" = 'OPENJLPT' AND "hanviet" = 'NGÂN HÀNH';`,
    ]);
  });

  it('trên DB thật: điền ô trống, sửa âm máy ghi, không đè âm người học đã sửa, bỏ qua mục tự thêm', () => {
    const url = createTestDb('hanviet-fill-');
    const db = new Database(url.replace(/^file:/, ''));
    const addUser = db.prepare(
      `INSERT INTO "user" ("id", "name", "email", "updatedAt") VALUES (?, ?, ?, 0)`,
    );
    addUser.run('learner', 'learner', 'l@example.test');
    addUser.run('second', 'second', 's@example.test');
    const insert = db.prepare(
      `INSERT INTO "Item" ("id", "userId", "kind", "expression", "hanviet", "meaningVi", "source") VALUES (?, ?, 'VOCAB', ?, ?, 'x', ?)`,
    );
    insert.run('empty', 'learner', '気分', null, 'OPENJLPT');
    insert.run('edited', 'learner', '年', 'NIÊN (sửa)', 'OPENJLPT');
    insert.run('manual', 'learner', '実', null, 'MANUAL');
    insert.run('machine', 'learner', '銀行', 'NGÂN HÀNH', 'OPENJLPT');
    insert.run('learner', 'learner', '社長', 'XÃ TRƯỞNG (tự sửa)', 'OPENJLPT');
    // The second learner's copy of the deck has its own ids (roadmap 7.2).
    insert.run('b-empty', 'second', '気分', null, 'OPENJLPT');
    insert.run('b-machine', 'second', '銀行', 'NGÂN HÀNH', 'OPENJLPT');
    const word = { a: '気分', b: '年', c: '実', d: '銀行', e: '社長' };
    const row = (id: keyof typeof word, hanviet: string | null) => ({
      id: `build-${id}`,
      kind: 'VOCAB',
      expression: word[id],
      hanviet,
    });
    db.exec(
      hanvietFillSql(
        [
          row('a', null),
          row('b', null),
          row('c', null),
          row('d', 'NGÂN HÀNH'),
          row('e', 'XÃ TRƯỜNG'),
        ],
        [
          row('a', 'KHÍ PHÂN'),
          row('b', 'NIÊN'),
          row('c', 'THỰC'),
          row('d', 'NGÂN HÀNG'),
          row('e', 'XÃ TRƯỞNG'),
        ],
      ),
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
      'b-empty': 'KHÍ PHÂN',
      'b-machine': 'NGÂN HÀNG',
    });
  });
});
