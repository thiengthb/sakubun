import { prisma } from '@/lib/db/db';
import type { UserDb } from '@/lib/db/user-db';
import {
  buildTableMergeSql,
  itemKey,
  planById,
  planItems,
  reconcileUsersByEmail,
  toDiff,
  type AccountBackup,
  type BackupGroup,
  type BackupGroupMember,
  type BackupItem,
  type BackupReviewLog,
  type BackupSentence,
  type BackupSrsState,
  type BackupTurn,
  type IdPlan,
  type TableDiff,
} from '@/lib/transfer/schema';

export interface ImportResult {
  dryRun: boolean;
  tables: TableDiff[];
  warnings: string[];
}

function byId<T extends { id: string }>(rows: readonly T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]));
}

function memberKey(groupId: string, itemId: string): string {
  return `${groupId}\u0000${itemId}`;
}

function itemData(row: BackupItem) {
  return {
    kind: row.kind,
    expression: row.expression,
    reading: row.reading ?? null,
    hanviet: row.hanviet ?? null,
    meaningVi: row.meaningVi,
    level: row.level,
    notes: row.notes ?? null,
    tags: row.tags ?? null,
    source: row.source,
    captureReason: row.captureReason ?? null,
    suspended: row.suspended,
    starred: row.starred,
    enrichment: row.enrichment ?? null,
    enrichedAt: row.enrichedAt ?? null,
  };
}

function srsData(row: BackupSrsState) {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    scheduledDays: row.scheduledDays,
    learningSteps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    lastReview: row.lastReview ?? null,
  };
}

function groupData(row: BackupGroup) {
  return {
    name: row.name,
    kind: row.kind,
    color: row.color ?? null,
    note: row.note ?? null,
  };
}

function sentenceData(row: BackupSentence) {
  return {
    direction: row.direction,
    context: row.context ?? null,
    exerciseType: row.exerciseType,
    sourceText: row.sourceText,
    sourceRuby: row.sourceRuby ?? null,
    userAnswer: row.userAnswer,
    suggested: row.suggested ?? null,
    suggestedRuby: row.suggestedRuby ?? null,
    feedback: row.feedback ?? null,
    score: row.score ?? null,
    stagedItems: row.stagedItems ?? null,
    status: row.status,
    starred: row.starred,
  };
}

function turnData(row: BackupTurn) {
  return {
    direction: row.direction,
    ja: row.ja,
    jaRuby: row.jaRuby ?? null,
    vi: row.vi,
    hint: row.hint ?? null,
    status: row.status,
    answer: row.answer ?? null,
    rating: row.rating ?? null,
    hinted: row.hinted,
    errorTags: row.errorTags ?? null,
    feedback: row.feedback ?? null,
    gradedAt: row.gradedAt ?? null,
  };
}

export async function importAccountData(
  db: UserDb,
  backup: AccountBackup,
  { dryRun }: { dryRun: boolean },
): Promise<ImportResult> {
  const [items, srsStates, reviewLogs, sentences, turns, settings, groups, groupMembers] =
    await Promise.all([
      db.item.findMany({
        select: { id: true, kind: true, expression: true },
      }),
      db.srsState.findMany({ select: { itemId: true } }),
      db.reviewLog.findMany({ select: { id: true } }),
      db.sentence.findMany({ select: { id: true } }),
      db.turn.findMany({ select: { id: true } }),
      db.settings.findFirst({ select: { id: true } }),
      db.group.findMany({ select: { id: true } }),
      db.groupMember.findMany({ select: { groupId: true, itemId: true } }),
    ]);

  const existingItemIds = new Set(items.map((i) => i.id));
  const existingItemKeys = new Map(items.map((i) => [itemKey(i.kind, i.expression), i.id]));
  const existingSrsItemIds = new Set(srsStates.map((s) => s.itemId));
  const existingLogIds = new Set(reviewLogs.map((r) => r.id));
  const existingSentenceIds = new Set(sentences.map((s) => s.id));
  const existingTurnIds = new Set(turns.map((t) => t.id));
  const existingGroupIds = new Set(groups.map((g) => g.id));
  const existingMemberKeys = new Set(groupMembers.map((m) => memberKey(m.groupId, m.itemId)));

  const warnings: string[] = [];

  const itemPlan = planItems(backup.items, existingItemIds, existingItemKeys);
  const itemContentClashes = itemPlan.skip.length;
  if (itemContentClashes > 0) {
    warnings.push(`${itemContentClashes} mục trùng nội dung (đã có dưới id khác) — bỏ qua.`);
  }
  const itemIdsAfter = new Set<string>(existingItemIds);
  for (const id of itemPlan.create) itemIdsAfter.add(id);

  const sentencePlan = planById(
    backup.sentences.map((s) => s.id),
    existingSentenceIds,
    'upsert',
  );
  const sentenceIdsAfter = new Set<string>(existingSentenceIds);
  for (const id of sentencePlan.create) sentenceIdsAfter.add(id);

  const turnPlan = planById(
    backup.turns.map((t) => t.id),
    existingTurnIds,
    'upsert',
  );
  const turnIdsAfter = new Set<string>(existingTurnIds);
  for (const id of turnPlan.create) turnIdsAfter.add(id);

  const srsUsable = backup.srsStates.filter((s) => itemIdsAfter.has(s.itemId));
  const srsPlan = planById(
    srsUsable.map((s) => s.itemId),
    existingSrsItemIds,
    'upsert',
  );
  const srsOrphans = backup.srsStates.length - srsUsable.length;
  if (srsOrphans > 0) warnings.push(`${srsOrphans} lịch ôn không có mục tương ứng — bỏ qua.`);

  const logPlan = planById(
    backup.reviewLogs.map((r) => r.id),
    existingLogIds,
    'insert-only',
  );

  const groupPlan = planById(
    backup.groups.map((g) => g.id),
    existingGroupIds,
    'upsert',
  );
  const groupIdsAfter = new Set<string>(existingGroupIds);
  for (const id of groupPlan.create) groupIdsAfter.add(id);

  const memberUsable = backup.groupMembers.filter(
    (m) => groupIdsAfter.has(m.groupId) && itemIdsAfter.has(m.itemId),
  );
  const memberPlan = planById(
    memberUsable.map((m) => memberKey(m.groupId, m.itemId)),
    existingMemberKeys,
    'insert-only',
  );
  const memberOrphans = backup.groupMembers.length - memberUsable.length;
  if (memberOrphans > 0)
    warnings.push(`${memberOrphans} liên kết nhóm thiếu nhóm hoặc mục tương ứng — bỏ qua.`);

  const settingsPlan: IdPlan = { create: [], update: [], skip: [] };
  if (backup.settings) {
    if (settings) settingsPlan.update.push('settings');
    else settingsPlan.create.push('settings');
  }

  const tables: TableDiff[] = [
    toDiff('Mục (từ/ngữ pháp)', itemPlan),
    toDiff('Lịch ôn FSRS', srsPlan),
    toDiff('Lịch sử ôn', logPlan),
    toDiff('Câu đã luyện', sentencePlan),
    toDiff('Lượt dịch', turnPlan),
    toDiff('Nhóm', groupPlan),
    toDiff('Mục trong nhóm', memberPlan),
    toDiff('Cài đặt', settingsPlan),
  ];

  if (dryRun) return { dryRun: true, tables, warnings };

  const itemsById = byId(backup.items);
  const sentencesById = byId(backup.sentences);
  const turnsById = byId(backup.turns);
  const srsByItemId = new Map(backup.srsStates.map((s) => [s.itemId, s]));
  const logsById = byId(backup.reviewLogs);
  const groupsById = byId(backup.groups);
  const membersByKey = new Map(
    backup.groupMembers.map((m) => [memberKey(m.groupId, m.itemId), m] as const),
  );

  await db.$transaction(
    async (tx) => {
      if (itemPlan.create.length > 0) {
        await tx.item.createMany({
          data: itemPlan.create.map((id) => {
            const row = itemsById.get(id) as BackupItem;
            return { id, createdAt: row.createdAt, ...itemData(row) };
          }),
        });
      }
      for (const id of itemPlan.update) {
        await tx.item.update({
          where: { id },
          data: itemData(itemsById.get(id) as BackupItem),
        });
      }

      if (sentencePlan.create.length > 0) {
        await tx.sentence.createMany({
          data: sentencePlan.create.map((id) => {
            const row = sentencesById.get(id) as BackupSentence;
            return {
              id,
              createdAt: row.createdAt,
              answeredAt: row.answeredAt ?? null,
              ...sentenceData(row),
            };
          }),
        });
      }
      for (const id of sentencePlan.update) {
        const row = sentencesById.get(id) as BackupSentence;
        await tx.sentence.update({
          where: { id },
          data: { answeredAt: row.answeredAt ?? null, ...sentenceData(row) },
        });
      }

      const linkedItem = (itemId: string | null | undefined) =>
        itemId && itemIdsAfter.has(itemId) ? itemId : null;
      if (turnPlan.create.length > 0) {
        await tx.turn.createMany({
          data: turnPlan.create.map((id) => {
            const row = turnsById.get(id) as BackupTurn;
            return {
              id,
              itemId: linkedItem(row.itemId),
              createdAt: row.createdAt,
              ...turnData(row),
            };
          }),
        });
      }
      for (const id of turnPlan.update) {
        const row = turnsById.get(id) as BackupTurn;
        await tx.turn.update({
          where: { id },
          data: { itemId: linkedItem(row.itemId), ...turnData(row) },
        });
      }

      if (srsPlan.create.length > 0) {
        await tx.srsState.createMany({
          data: srsPlan.create.map((itemId) => {
            const row = srsByItemId.get(itemId) as BackupSrsState;
            return { id: row.id, itemId, ...srsData(row) };
          }),
        });
      }
      for (const itemId of srsPlan.update) {
        await tx.srsState.update({
          where: { itemId },
          data: srsData(srsByItemId.get(itemId) as BackupSrsState),
        });
      }

      if (logPlan.create.length > 0) {
        await tx.reviewLog.createMany({
          data: logPlan.create.map((id) => {
            const row = logsById.get(id) as BackupReviewLog;
            const linkedSentence =
              row.sentenceId && sentenceIdsAfter.has(row.sentenceId) ? row.sentenceId : null;
            const linkedTurn = row.turnId && turnIdsAfter.has(row.turnId) ? row.turnId : null;
            return {
              id,
              itemId: linkedItem(row.itemId),
              sentenceId: linkedSentence,
              turnId: linkedTurn,
              channel: row.channel ?? null,
              rating: row.rating,
              state: row.state,
              role: row.role,
              errorTags: row.errorTags ?? null,
              due: row.due,
              stability: row.stability,
              difficulty: row.difficulty,
              reviewedAt: row.reviewedAt,
            };
          }),
        });
      }

      if (groupPlan.create.length > 0) {
        await tx.group.createMany({
          data: groupPlan.create.map((id) => {
            const row = groupsById.get(id) as BackupGroup;
            return { id, createdAt: row.createdAt, ...groupData(row) };
          }),
        });
      }
      for (const id of groupPlan.update) {
        await tx.group.update({
          where: { id },
          data: groupData(groupsById.get(id) as BackupGroup),
        });
      }
      if (memberPlan.create.length > 0) {
        await tx.groupMember.createMany({
          data: memberPlan.create.map((key) => {
            const row = membersByKey.get(key) as BackupGroupMember;
            return { groupId: row.groupId, itemId: row.itemId, addedAt: row.addedAt };
          }),
        });
      }

      if (backup.settings) {
        const row = await tx.settings.findFirst({ orderBy: { id: 'asc' } });
        if (row)
          await tx.settings.update({ where: { id: row.id }, data: { data: backup.settings.data } });
        else await tx.settings.create({ data: { data: backup.settings.data } });
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  );

  return { dryRun: false, tables, warnings };
}

interface SystemTable {
  name: string;
  conflict: string[];
  exclude?: string[];
  backupWhere?: string;
}

const SYSTEM_TABLES: SystemTable[] = [
  { name: 'user', conflict: ['id'] },
  { name: 'account', conflict: ['id'] },
  { name: 'mcp_key', conflict: ['id'] },
  { name: 'Item', conflict: ['id'] },
  { name: 'Sentence', conflict: ['id'] },
  { name: 'Turn', conflict: ['id'] },
  { name: 'SrsState', conflict: ['id'] },
  { name: 'ReviewLog', conflict: ['id'] },
  { name: 'Group', conflict: ['id'] },
  { name: 'GroupMember', conflict: ['groupId', 'itemId'] },
  {
    name: 'Settings',
    conflict: ['id'],
    backupWhere: 'NOT EXISTS (SELECT 1 FROM main."Settings")',
  },
];

const NEW_EMAIL_ONLY = 'b."email" NOT IN (SELECT "email" FROM main."user")';

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;
const sqlStr = (v: string) => `'${v.replace(/'/g, "''")}'`;

async function columnsOf(schema: string, table: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `PRAGMA ${schema}.table_info(${q(table)})`,
  );
  return rows.map((r) => r.name);
}

async function userColsOf(table: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ from: string; table: string }[]>(
    `PRAGMA main.foreign_key_list(${q(table)})`,
  );
  return rows.filter((r) => r.table === 'user').map((r) => r.from);
}

async function countOf(sql: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ n: number | bigint }[]>(sql);
  return Number(rows[0]?.n ?? 0);
}

export async function importSystemBackup(
  dbFilePath: string,
  { dryRun }: { dryRun: boolean },
): Promise<ImportResult> {
  const attachPath = dbFilePath.replace(/\\/g, '/').replace(/'/g, "''");
  const warnings: string[] = [];

  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  await prisma.$executeRawUnsafe(`ATTACH DATABASE '${attachPath}' AS backup`);

  try {
    const integrity = await prisma.$queryRawUnsafe<{ integrity_check: string }[]>(
      'PRAGMA backup.integrity_check',
    );
    const verdict = integrity[0]?.integrity_check;
    if (verdict !== 'ok')
      throw new Error(`Tệp sao lưu hỏng (integrity_check: ${verdict ?? 'unknown'}).`);

    const backupTables = new Set(
      (
        await prisma.$queryRawUnsafe<{ name: string }[]>(
          `SELECT name FROM backup.sqlite_master WHERE type = 'table'`,
        )
      ).map((r) => r.name),
    );
    if (!backupTables.has('Item') || !backupTables.has('user')) {
      throw new Error('Tệp không phải bản sao lưu sakubun (thiếu bảng Item/user).');
    }

    const backupUsers = await prisma.$queryRawUnsafe<{ id: string; email: string }[]>(
      'SELECT id, email FROM backup.user',
    );
    const liveUsers = await prisma.$queryRawUnsafe<{ id: string; email: string }[]>(
      'SELECT id, email FROM main.user',
    );
    const recon = reconcileUsersByEmail(backupUsers, liveUsers);
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS uidmap');
    await prisma.$executeRawUnsafe(
      'CREATE TEMP TABLE uidmap (old_id TEXT PRIMARY KEY, new_id TEXT NOT NULL)',
    );
    for (const [oldId, newId] of recon.idMap) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO uidmap (old_id, new_id) VALUES (${sqlStr(oldId)}, ${sqlStr(newId)})`,
      );
    }
    if (recon.idMap.size > 0)
      warnings.push(
        `${recon.idMap.size} tài khoản khớp theo email — dữ liệu của họ được gộp vào tài khoản sẵn có trên máy này.`,
      );

    const tables: TableDiff[] = [];
    const plans: { spec: SystemTable; cols: string[]; userCols: string[]; backupWhere?: string }[] =
      [];

    for (const spec of SYSTEM_TABLES) {
      if (!backupTables.has(spec.name)) continue; // older backup lacking a newer table
      const liveCols = new Set(await columnsOf('main', spec.name));
      const cols = (await columnsOf('backup', spec.name)).filter(
        (c) => liveCols.has(c) && !(spec.exclude ?? []).includes(c),
      );
      const userCols = (await userColsOf(spec.name)).filter((c) => cols.includes(c));
      const backupWhere = spec.name === 'user' ? NEW_EMAIL_ONLY : spec.backupWhere;
      plans.push({ spec, cols, userCols, backupWhere });

      const userSet = new Set(userCols);
      const conflictEq = spec.conflict
        .map((c) =>
          userSet.has(c)
            ? `m.${q(c)} = COALESCE((SELECT new_id FROM uidmap WHERE old_id = b.${q(c)}), b.${q(c)})`
            : `m.${q(c)} = b.${q(c)}`,
        )
        .join(' AND ');
      const bw = backupWhere ? ` WHERE ${backupWhere}` : '';
      const total = await countOf(`SELECT COUNT(*) AS n FROM backup.${q(spec.name)} b${bw}`);
      const present = await countOf(
        `SELECT COUNT(*) AS n FROM backup.${q(spec.name)} b WHERE ${backupWhere ? `(${backupWhere}) AND ` : ''}` +
          `EXISTS (SELECT 1 FROM main.${q(spec.name)} m WHERE ${conflictEq})`,
      );
      tables.push({ table: spec.name, create: total - present, update: 0, skip: present });
    }

    if (dryRun) return { dryRun: true, tables, warnings };

    await prisma.$transaction(
      async (tx) => {
        for (const { spec, cols, userCols, backupWhere } of plans) {
          if (cols.length === 0) continue;
          await tx.$executeRawUnsafe(
            buildTableMergeSql({ table: spec.name, cols, userCols, backupWhere }),
          );
        }

        const violations = await tx.$queryRawUnsafe<unknown[]>('PRAGMA foreign_key_check');
        if (violations.length > 0) {
          throw new Error(
            `Sau khi gộp phát hiện ${violations.length} liên kết hỏng — đã hủy, không thay đổi gì.`,
          );
        }
      },
      { timeout: 120_000, maxWait: 30_000 },
    );

    return { dryRun: false, tables, warnings };
  } finally {
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS uidmap').catch(() => {});
    await prisma.$executeRawUnsafe('DETACH DATABASE backup').catch(() => {});
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON').catch(() => {});
  }
}
