import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-import-restore-');

type Import = typeof import('@/lib/transfer/import');
type Schema = typeof import('@/lib/transfer/schema');
type Db = typeof import('@/lib/db/db');

let I: Import;
let S: Schema;
let prisma: Db['prisma'];

beforeAll(async () => {
  I = await import('@/lib/transfer/import');
  S = await import('@/lib/transfer/schema');
  ({ prisma } = await import('@/lib/db/db'));
});

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
    await resetLearningData(prisma);

    const res = await I.importAccountData(backupWithOneItem(), { dryRun: false });

    expect(res.dryRun).toBe(false);
    const item = await prisma.item.findFirst({ where: { id: 'itm-restore-1' } });
    expect(item, 'item trong bản sao lưu phải nằm lại trong DB').not.toBeNull();
    expect(item!.expression).toBe('RESTORE〜つつある');

    const srs = await prisma.srsState.findFirst({ where: { itemId: 'itm-restore-1' } });
    expect(srs, 'SrsState phải được restore cùng item').not.toBeNull();
    expect(srs!.reps).toBe(3);
    expect(srs!.lapses).toBe(1);
    expect(srs!.stability).toBeCloseTo(12.5, 5);
    expect(srs!.due.toISOString()).toBe(new Date('2026-08-20T00:00:00Z').toISOString());
  });

  it('bản sao lưu CŨ (còn visibility / forkedFromId / sharedAt) vẫn restore được', async () => {
    await resetLearningData(prisma);

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
