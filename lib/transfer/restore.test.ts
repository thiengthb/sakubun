import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { beforeAll, describe, expect, it } from 'vitest';
import type { UserDb } from '@/lib/db/user-db';
import { applyMigrations, createTestDb, createTestUser, resetLearningData } from '@/lib/db/test-db';

createTestDb('sakubun-import-restore-');

type Import = typeof import('@/lib/transfer/import');
type Schema = typeof import('@/lib/transfer/schema');
type Db = typeof import('@/lib/db/db');

let I: Import;
let S: Schema;
let prisma: Db['prisma'];
let unguardedPrisma: Db['unguardedPrisma'];
let learner: UserDb;

beforeAll(async () => {
  I = await import('@/lib/transfer/import');
  S = await import('@/lib/transfer/schema');
  ({ prisma, unguardedPrisma } = await import('@/lib/db/db'));
  learner = (await import('@/lib/db/user-db')).userDb(await createTestUser(prisma, 'learner'));
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

    const res = await I.importAccountData(learner, backupWithOneItem(), { dryRun: false });

    expect(res.dryRun).toBe(false);
    const item = await learner.item.findFirst({ where: { id: 'itm-restore-1' } });
    expect(item, 'item trong bản sao lưu phải nằm lại trong DB').not.toBeNull();
    expect(item!.expression).toBe('RESTORE〜つつある');

    const srs = await learner.srsState.findFirst({ where: { itemId: 'itm-restore-1' } });
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

    await I.importAccountData(learner, parsed.data, { dryRun: false });

    const item = await learner.item.findFirst({ where: { id: 'itm-legacy-1' } });
    expect(item, 'item của bản sao lưu cũ phải vào được DB').not.toBeNull();
    const sentence = await learner.sentence.findFirst({ where: { id: 'sen-legacy-1' } });
    expect(sentence, 'câu của bản sao lưu cũ phải vào được DB').not.toBeNull();
    expect(sentence!.userAnswer).toBe('Không thể không đi.');
  });

  it('dryRun KHÔNG ghi gì', async () => {
    await learner.srsState.deleteMany({});
    await learner.item.deleteMany({});

    const res = await I.importAccountData(learner, backupWithOneItem(), { dryRun: true });

    expect(res.dryRun).toBe(true);
    expect(await learner.item.count({ where: {} }), 'dryRun phải là đọc-thuần').toBe(0);
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

    const res = await I.importAccountData(learner, parsed.data, { dryRun: false });

    expect(res.tables.find((t) => t.table === 'Lượt dịch')).toMatchObject({ create: 1 });
    const turn = await learner.turn.findUniqueOrThrow({ where: { id: TURN.id } });
    expect(turn).toMatchObject({ itemId: 'itm-restore-1', status: 'graded', rating: 3 });
    const log = await learner.reviewLog.findUniqueOrThrow({ where: { id: TURN_LOG.id } });
    expect(log).toMatchObject({ turnId: TURN.id, channel: 'mcp' });
  });

  it('system restore copies Turn before ReviewLog, so the link passes the foreign key check', async () => {
    await resetLearningData(prisma);
    const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-sysbak-')), 'backup.db');
    // Made before 7.1a: no owner on any row, so the restore gives them to the live account.
    applyMigrations(file, { before: '20261025230000_learning_owner' });
    const db = new Database(file);
    db.prepare(
      `INSERT INTO Item (id, kind, expression, meaningVi, level, source, createdAt)
       VALUES ('itm-restore-1', 'GRAMMAR', '〜つつある', 'đang dần', 'N2', 'MCP', '2026-08-01T00:00:00.000+00:00')`,
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
    const log = await unguardedPrisma.reviewLog.findUniqueOrThrow({ where: { id: TURN_LOG.id } });
    expect(log).toMatchObject({ turnId: TURN.id, channel: 'mcp' });
    expect(await unguardedPrisma.turn.count()).toBe(1);
    expect(log.userId).toBe('learner');
    expect(await learner.item.count()).toBe(1);
  });

  it('restores a backup made before the v1 tables were dropped, skipping what no longer exists', async () => {
    await resetLearningData(prisma);
    const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'sakubun-sysbak-old-')), 'backup.db');
    applyMigrations(file, { before: '20261024100000_drop_v1_tables' });
    const db = new Database(file);
    db.prepare(
      `INSERT INTO Item (id, kind, expression, meaningVi, level, source, createdAt, challenge, challengeObservations)
       VALUES ('itm-old-1', 'VOCAB', '猫', 'mèo', 'N5', 'MCP', '2026-08-01T00:00:00.000+00:00', 1.5, 3)`,
    ).run();
    db.prepare(
      `INSERT INTO LearnerNote (id, text, evidence, expiresAt)
       VALUES ('n1', 'Hay nhầm に và で', '[]', '2026-09-01T00:00:00.000+00:00')`,
    ).run();
    db.close();

    const res = await I.importSystemBackup(file, { dryRun: false });

    expect(res.tables.map((t) => t.table)).not.toContain('LearnerNote');
    expect(
      await unguardedPrisma.item.findUniqueOrThrow({ where: { id: 'itm-old-1' } }),
    ).toMatchObject({
      expression: '猫',
      meaningVi: 'mèo',
    });
  });

  it('system restore gives learning rows to the live account with the same email (7.1)', async () => {
    await resetLearningData(prisma);
    const live = await prisma.user.create({
      data: { id: 'live-owner', name: 'thien', email: 'owner@example.com' },
    });
    const file = path.join(
      mkdtempSync(path.join(os.tmpdir(), 'sakubun-sysbak-owner-')),
      'backup.db',
    );
    applyMigrations(file);
    const db = new Database(file);
    db.prepare(
      `INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt, role)
       VALUES ('old-owner', 'thien', 'owner@example.com', 1, '2026-08-01T00:00:00.000+00:00',
               '2026-08-01T00:00:00.000+00:00', 'admin')`,
    ).run();
    db.prepare(
      `INSERT INTO Item (id, userId, kind, expression, meaningVi, level, source, createdAt)
       VALUES ('itm-owned-1', 'old-owner', 'VOCAB', '犬', 'chó', 'N5', 'MCP', '2026-08-01T00:00:00.000+00:00')`,
    ).run();
    db.prepare(
      `INSERT INTO ReviewLog (id, userId, itemId, rating, state, due, stability, difficulty)
       VALUES ('log-owned-1', 'old-owner', 'itm-owned-1', 3, 2, '2026-08-20T00:00:00.000+00:00', 12.5, 5.5)`,
    ).run();
    db.close();

    await I.importSystemBackup(file, { dryRun: false });

    expect(
      await unguardedPrisma.item.findUniqueOrThrow({ where: { id: 'itm-owned-1' } }),
    ).toMatchObject({
      userId: live.id,
    });
    expect(
      await unguardedPrisma.reviewLog.findUniqueOrThrow({ where: { id: 'log-owned-1' } }),
    ).toMatchObject({ userId: live.id });
    expect(await prisma.user.count({ where: { id: 'old-owner' } })).toBe(0);
    await prisma.user.delete({ where: { id: live.id } });
  });
});
