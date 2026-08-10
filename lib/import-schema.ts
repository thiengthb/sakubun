// Import (sync-from-backup) — validation + PURE diff planning. The counterpart to lib/export.ts.
//
// This module has NO database dependency on purpose: the file-parsing (Zod) and the create/update/skip
// planning are pure functions so they unit-test without a DB (the app's vitest suite is DB-free). The
// actual writes live in lib/import.ts. Two backup shapes are supported, mirroring the two export paths:
//   - a per-user JSON dump (`/api/export/mine` -> exportUserData) -> account sync, this file's Zod schema
//   - a whole-DB SQLite snapshot (`/api/backup`) -> system sync, handled table-wise in lib/import.ts
//
// Merge semantics (user decision 2026-07-23): UPSERT by stable id — add rows that are missing, update
// rows that already exist — never delete. `ReviewLog` is the one exception: insert-only, never updated
// (invariant #2, the log is append-only). This makes a re-import idempotent and loss-free.

import { z } from 'zod';

/** How a table reconciles an incoming row against an existing one. */
export type ImportMode = 'upsert' | 'insert-only';

// --- File schema (account JSON) -------------------------------------------------------------------
//
// Mirrors exportUserData's output. Dates serialize to ISO strings through JSON, so every DateTime is
// `z.coerce.date()` (ISO string -> Date). Rows are `.passthrough()`-free (unknown keys are stripped)
// so a future export field never blocks an older client. `userId` in the file is IGNORED on import —
// the importer always writes the CURRENT session user (see lib/import.ts), so a file can never be used
// to write into someone else's account. It is accepted here only so validation does not reject it.

const itemSchema = z.object({
  id: z.string().min(1),
  kind: z.string(),
  expression: z.string(),
  reading: z.string().nullish(),
  hanviet: z.string().nullish(),
  meaningVi: z.string(),
  level: z.string().default('N5'),
  notes: z.string().nullish(),
  tags: z.string().nullish(),
  source: z.string().default('MANUAL'),
  captureReason: z.string().nullish(),
  suspended: z.boolean().default(false),
  starred: z.boolean().default(false),
  enrichment: z.string().nullish(),
  enrichedAt: z.coerce.date().nullish(),
  createdAt: z.coerce.date().optional(),
  // `visibility` + `forkedFromId` đã bị bỏ khỏi đây cùng với hai cột tương ứng trên Item (migration
  // 20260803190730). Bản sao lưu CŨ vẫn đọc được: `z.object` mặc định LƯỢC key lạ, nên hai trường đó
  // bị bỏ qua thay vì làm file bị từ chối. Giữ chúng lại chỉ để zod điền `visibility: 'private'` rồi
  // đưa xuống Prisma — và đó đúng là cách restore hỏng.
});

const srsStateSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
  due: z.coerce.date(),
  stability: z.number(),
  difficulty: z.number(),
  scheduledDays: z.number().int(),
  learningSteps: z.number().int(),
  reps: z.number().int(),
  lapses: z.number().int(),
  state: z.number().int(),
  lastReview: z.coerce.date().nullish(),
});

const reviewLogSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().nullish(),
  rating: z.number().int(),
  state: z.number().int(),
  role: z.string().default('TARGET'),
  errorTags: z.string().nullish(),
  due: z.coerce.date(),
  stability: z.number(),
  difficulty: z.number(),
  reviewedAt: z.coerce.date().optional(),
  sentenceId: z.string().nullish(),
});

const sentenceSchema = z.object({
  id: z.string().min(1),
  direction: z.string(),
  context: z.string().nullish(),
  exerciseType: z.string().default('TRANSLATION'),
  sourceText: z.string(),
  sourceRuby: z.string().nullish(),
  userAnswer: z.string(),
  suggested: z.string().nullish(),
  suggestedRuby: z.string().nullish(),
  feedback: z.string().nullish(),
  score: z.number().int().nullish(),
  stagedItems: z.string().nullish(),
  status: z.string().default('PENDING'),
  starred: z.boolean().default(false),
  createdAt: z.coerce.date().optional(),
  answeredAt: z.coerce.date().nullish(),
  // `visibility` + `sharedAt`: cùng lý do như trên — cột đã bị xoá khỏi Sentence, key cũ được lược.
});

const settingsSchema = z.object({
  data: z.string(),
  updatedAt: z.coerce.date().optional(),
});

const groupSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  kind: z.string().default('mixed'),
  color: z.string().nullish(),
  note: z.string().nullish(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

const groupMemberSchema = z.object({
  groupId: z.string().min(1),
  itemId: z.string().min(1),
  addedAt: z.coerce.date().optional(),
});

/** The whole per-user export file. Everything except an empty object is tolerated; missing arrays
 *  default to empty so a partial/older export still imports what it has. */
export const accountBackupSchema = z.object({
  exportedAt: z.coerce.date().optional(),
  userId: z.string().nullish(),
  items: z.array(itemSchema).default([]),
  srsStates: z.array(srsStateSchema).default([]),
  reviewLogs: z.array(reviewLogSchema).default([]),
  sentences: z.array(sentenceSchema).default([]),
  settings: settingsSchema.nullish(),
  groups: z.array(groupSchema).default([]),
  groupMembers: z.array(groupMemberSchema).default([]),
});

export type AccountBackup = z.infer<typeof accountBackupSchema>;
export type BackupItem = z.infer<typeof itemSchema>;
export type BackupSrsState = z.infer<typeof srsStateSchema>;
export type BackupReviewLog = z.infer<typeof reviewLogSchema>;
export type BackupSentence = z.infer<typeof sentenceSchema>;
export type BackupGroup = z.infer<typeof groupSchema>;
export type BackupGroupMember = z.infer<typeof groupMemberSchema>;

/**
 * Parse + validate an untrusted account-backup file. Returns a typed result rather than throwing so a
 * bad upload becomes a clean 400 with a message, never a 500. `raw` is whatever `JSON.parse` produced.
 */
export function parseAccountBackup(
  raw: unknown,
): { ok: true; data: AccountBackup } | { ok: false; error: string } {
  const parsed = accountBackupSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.join('.') || '(gốc)';
    return {
      ok: false,
      error: `Tệp sao lưu không đúng định dạng tại "${where}": ${first?.message}`,
    };
  }
  return { ok: true, data: parsed.data };
}

// --- Pure diff planning ---------------------------------------------------------------------------

/** Which incoming ids will be created, updated, or skipped. Shared by dry-run (count) and apply. */
export interface IdPlan {
  create: string[];
  update: string[];
  skip: string[];
}

/** Per-table headline the preview renders. `skip` = rows deliberately not written (dup / conflict). */
export interface TableDiff {
  table: string;
  create: number;
  update: number;
  skip: number;
}

export function toDiff(table: string, plan: IdPlan): TableDiff {
  return { table, create: plan.create.length, update: plan.update.length, skip: plan.skip.length };
}

/**
 * Reconcile incoming rows against what already exists, keyed by a stable id.
 *   upsert      -> existing id updates, new id creates.
 *   insert-only -> existing id is skipped (never rewritten — e.g. ReviewLog, invariant #2).
 * A duplicate id inside the file itself is only acted on once; the rest are skipped.
 */
export function planById(
  incomingIds: readonly string[],
  existingIds: ReadonlySet<string>,
  mode: ImportMode = 'upsert',
): IdPlan {
  const plan: IdPlan = { create: [], update: [], skip: [] };
  const seen = new Set<string>();
  for (const id of incomingIds) {
    if (seen.has(id)) {
      plan.skip.push(id);
      continue;
    }
    seen.add(id);
    if (existingIds.has(id)) {
      if (mode === 'upsert') plan.update.push(id);
      else plan.skip.push(id);
    } else {
      plan.create.push(id);
    }
  }
  return plan;
}

/** The natural key that Item enforces per user: (kind, expression). NUL-joined so it can't collide. */
export function itemKey(kind: string, expression: string): string {
  return `${kind}\u0000${expression}`;
}

/**
 * Item has BOTH a stable id and a per-user unique (kind, expression). Reconcile by id first; but a NEW
 * id whose (kind, expression) already belongs to a DIFFERENT existing item is a genuine conflict —
 * writing it would violate @@unique([userId, kind, expression]) — so it is skipped and surfaced in the
 * preview ("N mục trùng nội dung, đã bỏ qua") rather than exploding the whole import.
 */
export function planItems(
  incoming: readonly { id: string; kind: string; expression: string }[],
  existingIds: ReadonlySet<string>,
  existingKeyToId: ReadonlyMap<string, string>,
): IdPlan {
  const plan: IdPlan = { create: [], update: [], skip: [] };
  const seen = new Set<string>();
  for (const row of incoming) {
    if (seen.has(row.id)) {
      plan.skip.push(row.id);
      continue;
    }
    seen.add(row.id);
    if (existingIds.has(row.id)) {
      plan.update.push(row.id);
      continue;
    }
    const ownerOfKey = existingKeyToId.get(itemKey(row.kind, row.expression));
    if (ownerOfKey !== undefined && ownerOfKey !== row.id) {
      plan.skip.push(row.id); // content already exists under another id
    } else {
      plan.create.push(row.id);
    }
  }
  return plan;
}

// --- System sync: cross-machine user identity (pure) ----------------------------------------------
//
// The whole-DB system sync used to merge the `user` table with ON CONFLICT(id). But better-auth mints a
// RANDOM id per signup, so the same person/email gets a different id on each machine — the merge then
// tries to INSERT a "new" user and trips @@unique([email]) (found 2026-07-24). Identity
// across machines is EMAIL, not id. These pure helpers compute the reconciliation; lib/import.ts applies
// it in SQL. Kept DB-free so the id-translation logic — where a bug would silently misfile a user's data
// — is unit-tested without a database.

export interface UserReconcile {
  /** backup user id -> live user id, for backup users whose email ALREADY exists locally (id differs). */
  idMap: Map<string, string>;
  /** backup user ids whose email is NOT present locally -> insert the user row as-is (keep its id). */
  insertUserIds: Set<string>;
}

/** Case/space-insensitive email key (better-auth lowercases, but a snapshot may predate that). */
const emailKey = (email: string): string => email.trim().toLowerCase();

/**
 * Match backup users to live users by EMAIL. A matched email yields an id-map entry (backup id -> the
 * local id that already owns that email) so every row the backup user owns can be re-homed onto the
 * local account; a brand-new email is flagged for insertion with its own id. A backup user whose id is
 * already identical locally needs neither (it is the same row) — no map entry, not re-inserted.
 */
export function reconcileUsersByEmail(
  backupUsers: readonly { id: string; email: string }[],
  liveUsers: readonly { id: string; email: string }[],
): UserReconcile {
  const liveByEmail = new Map(liveUsers.map((u) => [emailKey(u.email), u.id]));
  const idMap = new Map<string, string>();
  const insertUserIds = new Set<string>();
  for (const u of backupUsers) {
    const liveId = liveByEmail.get(emailKey(u.email));
    if (liveId === undefined) insertUserIds.add(u.id);
    else if (liveId !== u.id) idMap.set(u.id, liveId);
  }
  return { idMap, insertUserIds };
}

const qid = (id: string): string => `"${id.replace(/"/g, '""')}"`;

/**
 * Build the merge INSERT for one table of the system sync. Every user-referencing column (`userId`,
 * `authorId`, ...) is translated through the connection-level TEMP table `uidmap(old_id, new_id)` so a
 * row re-homes onto the locally-matched user; other columns copy verbatim. `INSERT OR IGNORE` makes the
 * whole merge loss-free and collision-proof: a row that already exists — by primary key OR any secondary
 * unique (e.g. Item's (kind, expression) after re-homing) — is skipped, never overwritten and
 * never a crash. (`INSERT OR IGNORE`, not a targetless `ON CONFLICT DO NOTHING`, because the latter is a
 * syntax error on the SQLite build behind the driver adapter.) This is add-only MERGE semantics: existing
 * rows are kept as-is (the trade for never throwing on a unique clash and never destroying local edits).
 */
export function buildTableMergeSql(opts: {
  table: string;
  cols: readonly string[];
  /** Subset of `cols` that reference user.id and must be translated via uidmap. */
  userCols: readonly string[];
  /** Extra filter on the backup rows (alias `b`), e.g. only-new-email users. */
  backupWhere?: string;
}): string {
  const userSet = new Set(opts.userCols);
  const colList = opts.cols.map(qid).join(', ');
  const selList = opts.cols
    .map((c) =>
      userSet.has(c)
        ? `COALESCE((SELECT new_id FROM uidmap WHERE old_id = b.${qid(c)}), b.${qid(c)})`
        : `b.${qid(c)}`,
    )
    .join(', ');
  const where = opts.backupWhere ? ` WHERE ${opts.backupWhere}` : '';
  return (
    `INSERT OR IGNORE INTO main.${qid(opts.table)} (${colList}) ` +
    `SELECT ${selList} FROM backup.${qid(opts.table)} b${where}`
  );
}
