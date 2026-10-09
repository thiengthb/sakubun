// ĐƯỜNG PHỤC HỒI DỮ LIỆU — `importAccountData`, và cho tới hôm nay nó KHÔNG có một dòng test nào.
//
// `lib/import.test.ts` nói thẳng lý do: *"The DB writes (lib/import.ts) need a database and are out of
// scope for the DB-free vitest suite"*. Nhưng `lib/test-db.ts` (2026-08-06) đã dựng được DB tạm bằng
// cách áp migration đã commit, không cần subprocess — nên lý do đó hết hiệu lực, và phần duy nhất có
// thể lấy lại dữ liệu học của người dùng vẫn đang không được gác.
//
// `CLAUDE.md` gọi `lib/import.ts` là NGOẠI LỆ duy nhất được ghi `SrsState` trực tiếp: nó restore
// nguyên văn state đã lưu, không tính lại. Một ngoại lệ như vậy phải có lưới đúng hơn mức trung bình,
// không phải thấp hơn.

import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '@/lib/test-db';

createTestDb('sakubun-import-restore-');

type Import = typeof import('@/lib/import');
type Schema = typeof import('@/lib/import-schema');
type Db = typeof import('@/lib/db');

let I: Import;
let S: Schema;
let prisma: Db['prisma'];

beforeAll(async () => {
  I = await import('@/lib/import');
  S = await import('@/lib/import-schema');
  ({ prisma } = await import('@/lib/db'));
});

/** Bản sao lưu tối thiểu nhưng THẬT: đi qua đúng `parseAccountBackup` mà route API dùng. */
function backupWithOneItem() {
  const raw = {
    exportedAt: '2026-08-10T00:00:00Z',
    userId: 'u1',
    items: [
      {
        id: 'itm-restore-1',
        kind: 'GRAMMAR',
        expression: 'RESTORE〜つつある',
        meaningVi: 'đang dần',
        level: 'N2',
        createdAt: '2026-08-01T00:00:00Z',
      },
    ],
    srsStates: [
      {
        id: 'srs-restore-1',
        itemId: 'itm-restore-1',
        due: '2026-08-20T00:00:00Z',
        stability: 12.5,
        difficulty: 5.5,
        scheduledDays: 10,
        learningSteps: 0,
        reps: 3,
        lapses: 1,
        state: 2,
        lastReview: '2026-08-10T00:00:00Z',
      },
    ],
  };
  const parsed = S.parseAccountBackup(raw);
  if (!parsed.ok) throw new Error(`fixture sai định dạng: ${parsed.error}`);
  return parsed.data;
}

describe('importAccountData — restore một bản sao lưu', () => {
  it('ghi được item + SrsState vào DB', async () => {
    await prisma.reviewLog.deleteMany({});
    await prisma.sentence.deleteMany({});
    await prisma.srsState.deleteMany({});
    await prisma.item.deleteMany({});

    // Nếu lời gọi này ném thì đây chính là bug, không phải test hỏng: `itemData()` trong lib/import.ts
    // vẫn gắn `visibility` + `forkedFromId` vào data đưa cho Prisma, và hai cột đó đã bị migration
    // 20260803190730 (bỏ multiuser) XOÁ khỏi bảng Item. `sentenceData()` cũng vậy với `sharedAt`.
    // Typecheck không bắt được vì TypeScript không excess-check thuộc tính đến từ spread.
    const res = await I.importAccountData(backupWithOneItem(), { dryRun: false });

    expect(res.dryRun).toBe(false);
    const item = await prisma.item.findFirst({ where: { id: 'itm-restore-1' } });
    expect(item, 'item trong bản sao lưu phải nằm lại trong DB').not.toBeNull();
    expect(item!.expression).toBe('RESTORE〜つつある');

    // State được restore NGUYÊN VĂN, không tính lại — đó là cả lý do import được phép ghi SrsState.
    const srs = await prisma.srsState.findFirst({ where: { itemId: 'itm-restore-1' } });
    expect(srs, 'SrsState phải được restore cùng item').not.toBeNull();
    expect(srs!.reps).toBe(3);
    expect(srs!.lapses).toBe(1);
    expect(srs!.stability).toBeCloseTo(12.5, 5);
    expect(srs!.due.toISOString()).toBe(new Date('2026-08-20T00:00:00Z').toISOString());
  });

  it('bản sao lưu CŨ (còn visibility / forkedFromId / sharedAt) vẫn restore được', async () => {
    // Đây là lời tuyên bố tương thích ngược mà comment trong import-schema.ts đưa ra, nên nó phải được
    // ĐO. Một file xuất ra trước 2026-08-03 mang ba trường của thời multiuser; `z.object` lược key lạ,
    // nên chúng bị bỏ qua thay vì làm file bị từ chối.
    await prisma.reviewLog.deleteMany({});
    await prisma.sentence.deleteMany({});
    await prisma.srsState.deleteMany({});
    await prisma.item.deleteMany({});

    const legacy = {
      exportedAt: '2026-08-01T00:00:00Z',
      userId: 'u-old',
      items: [
        {
          id: 'itm-legacy-1',
          kind: 'GRAMMAR',
          expression: 'LEGACY〜ざるを得ない',
          meaningVi: 'không thể không',
          level: 'N2',
          visibility: 'shared',
          forkedFromId: 'itm-someone-else',
        },
      ],
      sentences: [
        {
          id: 'sen-legacy-1',
          direction: 'JA_VI',
          sourceText: '行かざるを得ない。',
          userAnswer: 'Không thể không đi.',
          status: 'GRADED',
          visibility: 'shared',
          sharedAt: '2026-08-01T10:00:00Z',
        },
      ],
    };
    const parsed = S.parseAccountBackup(legacy);
    expect(parsed.ok, 'file cũ phải PARSE được, không bị từ chối').toBe(true);
    if (!parsed.ok) return;

    await I.importAccountData(parsed.data, { dryRun: false });

    const item = await prisma.item.findFirst({ where: { id: 'itm-legacy-1' } });
    expect(item, 'item của bản sao lưu cũ phải vào được DB').not.toBeNull();
    const sentence = await prisma.sentence.findFirst({ where: { id: 'sen-legacy-1' } });
    expect(sentence, 'câu của bản sao lưu cũ phải vào được DB').not.toBeNull();
    expect(sentence!.userAnswer).toBe('Không thể không đi.');
  });

  it('dryRun KHÔNG ghi gì', async () => {
    await prisma.srsState.deleteMany({});
    await prisma.item.deleteMany({});

    const res = await I.importAccountData(backupWithOneItem(), { dryRun: true });

    expect(res.dryRun).toBe(true);
    expect(await prisma.item.count({ where: {} }), 'dryRun phải là đọc-thuần').toBe(0);
  });
});
