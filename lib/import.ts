// Import (sync-from-backup) — the DB writes. Validation + pure planning live in lib/import-schema.ts.
//
// WHY this exists (decided 2026-07-20, re-opened 2026-07-23): a REPLACE-style restore is not
// possible from inside the app — the process holds the DB file open — and rewriting ReviewLog in place
// would break invariant #2 (append-only). So both paths here are a MERGE: nothing is ever deleted, and
// there is no file swap. Replacing the file outright stays a manual, container-level operation (the
// commands are in the settings Data tab).
//
// Two surfaces, mirroring the two exports:
//   - importAccountData: the learning-data JSON (lib/export.ts) synced back in through Prisma. UPSERT by
//     stable id — add what is missing, update what is there — except ReviewLog, which is insert-only.
//   - importSystemBackup: a whole-DB SQLite snapshot (app/api/backup) merged table-wise in raw SQL
//     (ATTACH + INSERT OR IGNORE). ADD-ONLY: a row that already exists locally is KEPT, never
//     overwritten. Raw SQL because it touches the auth tables, which have no Prisma-model path here.
//
// The two therefore differ in one visible way, and the UI says so: an account sync can UPDATE existing
// rows, a system sync can only ADD (its dry-run reports `update: 0` for every table by construction).
//
// A dry-run returns the same per-table counts the apply would produce, and writes nothing.

import { prisma } from '@/lib/db';
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
  type IdPlan,
  type TableDiff,
} from '@/lib/import-schema';

export interface ImportResult {
  dryRun: boolean;
  tables: TableDiff[];
  /** Human-readable notes about rows that were skipped for a reason (missing referent, content clash). */
  warnings: string[];
}

// --- Account sync (per-user JSON, guarded Prisma) -------------------------------------------------

/** Index an array by a derived key for O(1) lookup when mapping planned ids back to their rows. */
function byId<T extends { id: string }>(rows: readonly T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]));
}

/** GroupMember has no id — its identity is the pair. NUL-joined so two ids can never blur together. */
function memberKey(groupId: string, itemId: string): string {
  return `${groupId}\u0000${itemId}`;
}

/** Fields written for an Item (id + userId handled by the caller). Nullish -> null (Prisma wants null). */
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
    visibility: row.visibility,
    forkedFromId: row.forkedFromId ?? null,
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

/** Fields written for a Group (id + createdAt handled by the caller; updatedAt is Prisma's). */
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
    visibility: row.visibility,
    sharedAt: row.sharedAt ?? null,
  };
}

/**
 * Sync a learning-data backup (the JSON from `/api/export/mine`) back in. Merge-by-id, never delete.
 * On dryRun, nothing is written — only the counts that WOULD apply are returned.
 */
export async function importAccountData(
  backup: AccountBackup,
  { dryRun }: { dryRun: boolean },
): Promise<ImportResult> {
  // What is already here. Read once, plan in memory.
  const [items, srsStates, reviewLogs, sentences, settings, groups, groupMembers] =
    await Promise.all([
      prisma.item.findMany({
        select: { id: true, kind: true, expression: true },
      }),
      prisma.srsState.findMany({ select: { itemId: true } }),
      prisma.reviewLog.findMany({ select: { id: true } }),
      prisma.sentence.findMany({ select: { id: true } }),
      prisma.settings.findFirst({ select: { id: true } }),
      prisma.group.findMany({ select: { id: true } }),
      prisma.groupMember.findMany({ select: { groupId: true, itemId: true } }),
    ]);

  const existingItemIds = new Set(items.map((i) => i.id));
  const existingItemKeys = new Map(items.map((i) => [itemKey(i.kind, i.expression), i.id]));
  const existingSrsItemIds = new Set(srsStates.map((s) => s.itemId));
  const existingLogIds = new Set(reviewLogs.map((r) => r.id));
  const existingSentenceIds = new Set(sentences.map((s) => s.id));
  const existingGroupIds = new Set(groups.map((g) => g.id));
  const existingMemberKeys = new Set(groupMembers.map((m) => memberKey(m.groupId, m.itemId)));

  const warnings: string[] = [];

  // Items first: everything else references them.
  const itemPlan = planItems(backup.items, existingItemIds, existingItemKeys);
  const itemContentClashes = itemPlan.skip.length;
  if (itemContentClashes > 0) {
    warnings.push(`${itemContentClashes} mục trùng nội dung (đã có dưới id khác) — bỏ qua.`);
  }
  // Every item id that will exist after this import (existing + newly created). FK target set.
  const itemIdsAfter = new Set<string>(existingItemIds);
  for (const id of itemPlan.create) itemIdsAfter.add(id);

  // Sentences (ReviewLog references them).
  const sentencePlan = planById(
    backup.sentences.map((s) => s.id),
    existingSentenceIds,
    'upsert',
  );
  const sentenceIdsAfter = new Set<string>(existingSentenceIds);
  for (const id of sentencePlan.create) sentenceIdsAfter.add(id);

  // SrsState keyed by itemId (1:1). Only rows whose item will exist; the rest are skipped.
  const srsUsable = backup.srsStates.filter((s) => itemIdsAfter.has(s.itemId));
  const srsPlan = planById(
    srsUsable.map((s) => s.itemId),
    existingSrsItemIds,
    'upsert',
  );
  const srsOrphans = backup.srsStates.length - srsUsable.length;
  if (srsOrphans > 0) warnings.push(`${srsOrphans} lịch ôn không có mục tương ứng — bỏ qua.`);

  // ReviewLog: insert-only (invariant #2). Dangling item/sentence refs are nulled, not dropped — the
  // log is append-only and must keep counting toward the owner's streak even without its item.
  const logPlan = planById(
    backup.reviewLogs.map((r) => r.id),
    existingLogIds,
    'insert-only',
  );

  // Study groups: upsert by id. Restored to this path on 2026-08-05 — the tables came back with the
  // feature (commit f992bdf) but the sync still answered "app không còn tính năng nhóm" and dropped them.
  const groupPlan = planById(
    backup.groups.map((g) => g.id),
    existingGroupIds,
    'upsert',
  );
  const groupIdsAfter = new Set<string>(existingGroupIds);
  for (const id of groupPlan.create) groupIdsAfter.add(id);

  // A membership is meaningless without BOTH ends (schema cascades on either), so a row whose group or
  // item will not exist after this import is skipped, and said out loud. Insert-only: an existing
  // membership has nothing to update but `addedAt`, and rewriting that would move history for no gain.
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

  // Settings is a singleton, so its "plan" is a single create or a single update. The pushed value is
  // never read (only the counts are), but it has to BE something: `push()` with no argument adds
  // nothing, which is why the preview reported 0 changes to settings until 2026-08-05.
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
    toDiff('Nhóm', groupPlan),
    toDiff('Mục trong nhóm', memberPlan),
    toDiff('Cài đặt', settingsPlan),
  ];

  if (dryRun) return { dryRun: true, tables, warnings };

  // --- Apply. One interactive transaction: either the whole sync lands or none of it does. Creates go
  // through createMany (one statement); the far smaller update sets loop.
  const itemsById = byId(backup.items);
  const sentencesById = byId(backup.sentences);
  const srsByItemId = new Map(backup.srsStates.map((s) => [s.itemId, s]));
  const logsById = byId(backup.reviewLogs);
  const groupsById = byId(backup.groups);
  const membersByKey = new Map(
    backup.groupMembers.map((m) => [memberKey(m.groupId, m.itemId), m] as const),
  );

  await prisma.$transaction(
    async (tx) => {
      // Items.
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

      // Sentences.
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

      // SrsState (keyed by itemId).
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

      // ReviewLog (insert-only, dangling refs nulled).
      if (logPlan.create.length > 0) {
        await tx.reviewLog.createMany({
          data: logPlan.create.map((id) => {
            const row = logsById.get(id) as BackupReviewLog;
            const linkedItem = row.itemId && itemIdsAfter.has(row.itemId) ? row.itemId : null;
            const linkedSentence =
              row.sentenceId && sentenceIdsAfter.has(row.sentenceId) ? row.sentenceId : null;
            return {
              id,
              itemId: linkedItem,
              sentenceId: linkedSentence,
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

      // Groups, then memberships (the join rows reference both a group and an item, and both have to
      // exist by now — items were written first, groups here).
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

      // Settings: the one singleton row.
      if (backup.settings) {
        const row = await tx.settings.findFirst({ orderBy: { id: 'asc' } });
        if (row) await tx.settings.update({ where: { id: row.id }, data: { data: backup.settings.data } });
        else await tx.settings.create({ data: { data: backup.settings.data } });
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  );

  return { dryRun: false, tables, warnings };
}

// --- System sync (whole-DB SQLite snapshot, raw SQL) ----------------------------------------------

/** A managed table + how it merges. Order = FK parents first, so ordered inserts satisfy references. */
interface SystemTable {
  /** SQLite table name (Prisma @@map lowercases the auth tables; domain models keep their model name). */
  name: string;
  /** Column(s) that identify "the same row" — used only to ESTIMATE the dry-run counts (see below). */
  conflict: string[];
  /** Columns to NOT carry over. */
  exclude?: string[];
  /** Extra filter on the backup rows (alias `b`). */
  backupWhere?: string;
}

// EVERY table this list names must exist in the CURRENT schema. A table missing from the backup is
// skipped safely (`backupTables.has`), but one missing LOCALLY is not: the count query joins against
// `main.<table>` and dies with "no such table". That is what the four community tables (ItemLike,
// SentenceLike, Comment, CommentVote) did to any restore of a pre-single-user snapshot until 2026-08-05
// — they were dropped from the schema and left in this list.
//
// `session` and `verification` are intentionally NOT restored: they are ephemeral auth state (live
// logins, pending email tokens). Reviving stale sessions from a snapshot would be wrong and unsafe.
// `user`/`account`/`mcp_key` ARE merged, but identity is reconciled by EMAIL (see below) and every
// user-referencing column is translated so a row re-homes onto the locally-matched account.
const SYSTEM_TABLES: SystemTable[] = [
  { name: 'user', conflict: ['id'] },
  { name: 'account', conflict: ['id'] },
  { name: 'mcp_key', conflict: ['id'] },
  { name: 'Item', conflict: ['id'] },
  { name: 'Sentence', conflict: ['id'] },
  { name: 'SrsState', conflict: ['id'] },
  { name: 'ReviewLog', conflict: ['id'] },
  { name: 'Group', conflict: ['id'] },
  { name: 'GroupMember', conflict: ['groupId', 'itemId'] },
  // The tutor's own working state. Missing from this list until 2026-08-05, so a whole-DB sync silently
  // dropped every learner note, the ability estimate and the whole shadow-proposal log — the three
  // things a snapshot is the ONLY copy of (the JSON export does not carry them either).
  { name: 'LearnerNote', conflict: ['id'] },
  { name: 'LearnerAbility', conflict: ['id'] },
  { name: 'CalibrationProposal', conflict: ['id'] },
  {
    name: 'Settings',
    conflict: ['id'],
    // Settings is a SINGLETON row now (it was one row per user, keyed on `userId` — a column this
    // schema no longer has, which made the count query throw "no such column: b.userId" and took the
    // whole system sync down with it). Two rows would be worse than none: every reader takes "the
    // first" one, so which settings apply would depend on rowid. The backup's settings are therefore
    // adopted only by an instance that has none.
    backupWhere: 'NOT EXISTS (SELECT 1 FROM main."Settings")',
  },
];

// The `user` merge inserts ONLY genuinely-new emails; a backup user whose email already exists locally
// is NOT re-inserted (its data is re-homed onto the local account via uidmap instead). This is what
// makes "same email, different id" stop colliding on @@unique([email]).
const NEW_EMAIL_ONLY = 'b."email" NOT IN (SELECT "email" FROM main."user")';

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;
const sqlStr = (v: string) => `'${v.replace(/'/g, "''")}'`;

/** Column names of a table in a given schema (main | backup). */
async function columnsOf(schema: string, table: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
    `PRAGMA ${schema}.table_info(${q(table)})`,
  );
  return rows.map((r) => r.name);
}

/** Columns of a live table whose FK targets the `user` table (authorId, …) — the ones to remap. */
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

/**
 * Merge a whole-DB backup into the live DB (the caller enforces that the requester is signed in). The
 * backup file is ATTACHed and merged table-by-table in raw SQL — raw because this reaches the auth
 * tables, which have no Prisma-model path in this module.
 *
 * Cross-machine identity (2026-07-24): better-auth mints a RANDOM user id per
 * signup, so the same person has a different id on each machine. We therefore reconcile users by EMAIL:
 * a backup user whose email already exists locally is matched to the local id (uidmap), and EVERY
 * user-referencing column is translated through that map so their rows re-home onto the local account;
 * only genuinely-new emails insert a new user row. Every table uses `INSERT OR IGNORE`, so the merge is
 * loss-free and collision-proof — a row already present (by pk OR any secondary unique,
 * e.g. Item's (kind, expression) after re-homing) is skipped, never overwritten, never a crash.
 * Add-only MERGE: existing rows are kept as-is. On dryRun, nothing is written (counts are estimated by
 * the primary key, so a secondary-unique skip may read as an insert — a preview, not a guarantee).
 */
export async function importSystemBackup(
  dbFilePath: string,
  { dryRun }: { dryRun: boolean },
): Promise<ImportResult> {
  const attachPath = dbFilePath.replace(/\\/g, '/').replace(/'/g, "''");
  const warnings: string[] = [];

  // FK enforcement OFF for the merge window: ordered inserts + Item's forkedFromId self-reference can
  // otherwise trip immediate FK checks. A PRAGMA cannot run inside a transaction, so it is set here and
  // always restored in `finally`. `foreign_key_check` after the inserts is the real safety net.
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  await prisma.$executeRawUnsafe(`ATTACH DATABASE '${attachPath}' AS backup`);

  try {
    // Validate the attached file before trusting it — a torn/foreign file must fail loudly, not corrupt.
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

    // Reconcile users by email and materialise the id-map in a connection-level TEMP table. `uidmap` is
    // visible both to the counting queries below and inside the apply transaction (same connection as
    // the ATTACH). Built even on dryRun so the estimated counts reflect the re-homing; dropped in finally.
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
      // Only columns present in BOTH schemas move — tolerates minor schema drift between versions.
      const liveCols = new Set(await columnsOf('main', spec.name));
      const cols = (await columnsOf('backup', spec.name)).filter(
        (c) => liveCols.has(c) && !(spec.exclude ?? []).includes(c),
      );
      const userCols = (await userColsOf(spec.name)).filter((c) => cols.includes(c));
      const backupWhere = spec.name === 'user' ? NEW_EMAIL_ONLY : spec.backupWhere;
      plans.push({ spec, cols, userCols, backupWhere });

      // Estimate the diff by the primary conflict key, translating any user-referencing key column so a
      // re-homed row counts against the LOCAL owner (only Settings' key is user-referencing today).
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

    // Apply inside a transaction: all tables merge or none do. `backup` + `uidmap` stay live across it
    // (both are connection-level, and Prisma's interactive tx runs on the same connection).
    await prisma.$transaction(
      async (tx) => {
        for (const { spec, cols, userCols, backupWhere } of plans) {
          if (cols.length === 0) continue;
          await tx.$executeRawUnsafe(
            buildTableMergeSql({ table: spec.name, cols, userCols, backupWhere }),
          );
        }

        // Prove referential integrity before committing; any dangling FK rolls the whole merge back.
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
