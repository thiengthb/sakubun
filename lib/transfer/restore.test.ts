import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyMigrations, createTestDb, resetLearningData } from '@/lib/db/test-db';

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

const TURN = {
  id: 'turn-restore-1',
  itemId: 'itm-restore-1',
  direction: 'JA_VI',
  ja: '変わりつつある',
  vi: 'đang dần thay đổi',
  status: 'graded',
  answer: 'đang thay đổi',
  rating: 3,
  createdAt: '2026-08-10T00:00:00Z',
  gradedAt: '2026-08-10T00:01:00Z',
};
const TURN_LOG = {
  id: 'log-restore-1',
  itemId: 'itm-restore-1',
  rating: 3,
  state: 2,
  due: '2026-08-20T00:00:00Z',
  stability: 12.5,
  difficulty: 5.5,
  reviewedAt: '2026-08-10T00:01:00Z',
  turnId: 'turn-restore-1',
  channel: 'mcp',
};

describe('v2 turns survive a backup', () => {
  it('account restore brings back the turn and the review linked to it', async () => {
    await resetLearningData(prisma);
    const base = backupWithOneItem();
    const parsed = S.parseAccountBackup({ ...base, turns: [TURN], reviewLogs: [TURN_LOG] });
    if (!parsed.ok) throw new Error(parsed.error);

    const res = await I.importAccountData(parsed.data, { dryRun: false });

    expect(res.tables.find((t) => t.table === 'Lượt dịch')).toMatchObject({ create: 1 });
    const turn = await prisma.turn.findUniqueOrThrow({ where: { id: TURN.id } });
    expect(turn).toMatchObject({ itemId: 'itm-restore-1', status: 'graded', rating: 3 });
    const log = await prisma.reviewLog.findUniqueOrThrow({ where: { id: TURN_LOG.id } });
    expect(log).toMatchObject({ turnId: TURN.id, channel: 'mcp' });
  });

  it('system restore copies Turn before ReviewLog, so the link passes the foreign key check', async () => {
    await resetLearningData(prisma);
    const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-sysbak-')), 'backup.db');
    applyMigrations(file);
    const db = new Database(file);
    db.prepare(
      `INSERT INTO Item (id, kind, expression, meaningVi, level, source, createdAt, challengeObservations)
       VALUES ('itm-restore-1', 'GRAMMAR', '〜つつある', 'đang dần', 'N2', 'MCP', '2026-08-01T00:00:00.000+00:00', 0)`,
    ).run();
    db.prepare(
      `INSERT INTO Turn (id, itemId, direction, ja, vi, status) VALUES (?, ?, 'JA_VI', ?, ?, 'graded')`,
    ).run(TURN.id, TURN.itemId, TURN.ja, TURN.vi);
    db.prepare(
      `INSERT INTO ReviewLog (id, itemId, rating, state, due, stability, difficulty, turnId, channel)
       VALUES (?, 'itm-restore-1', 3, 2, '2026-08-20T00:00:00.000+00:00', 12.5, 5.5, ?, 'mcp')`,
    ).run(TURN_LOG.id, TURN.id);
    db.close();

    const res = await I.importSystemBackup(file, { dryRun: false });

    expect(res.tables.find((t) => t.table === 'Turn')).toMatchObject({ create: 1 });
    const log = await prisma.reviewLog.findUniqueOrThrow({ where: { id: TURN_LOG.id } });
    expect(log).toMatchObject({ turnId: TURN.id, channel: 'mcp' });
    expect(await prisma.turn.count()).toBe(1);
  });
});
