import { z } from 'zod';

export type ImportMode = 'upsert' | 'insert-only';

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
  turnId: z.string().nullish(),
  channel: z.string().nullish(),
});

const turnSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().nullish(),
  direction: z.string(),
  ja: z.string(),
  jaRuby: z.string().nullish(),
  vi: z.string(),
  hint: z.string().nullish(),
  status: z.string().default('staged'),
  answer: z.string().nullish(),
  rating: z.number().int().nullish(),
  hinted: z.boolean().default(false),
  errorTags: z.string().nullish(),
  feedback: z.string().nullish(),
  createdAt: z.coerce.date().optional(),
  gradedAt: z.coerce.date().nullish(),
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

export const accountBackupSchema = z.object({
  exportedAt: z.coerce.date().optional(),
  userId: z.string().nullish(),
  items: z.array(itemSchema).default([]),
  srsStates: z.array(srsStateSchema).default([]),
  reviewLogs: z.array(reviewLogSchema).default([]),
  sentences: z.array(sentenceSchema).default([]),
  turns: z.array(turnSchema).default([]),
  settings: settingsSchema.nullish(),
  groups: z.array(groupSchema).default([]),
  groupMembers: z.array(groupMemberSchema).default([]),
});

export type AccountBackup = z.infer<typeof accountBackupSchema>;
export type BackupItem = z.infer<typeof itemSchema>;
export type BackupSrsState = z.infer<typeof srsStateSchema>;
export type BackupReviewLog = z.infer<typeof reviewLogSchema>;
export type BackupSentence = z.infer<typeof sentenceSchema>;
export type BackupTurn = z.infer<typeof turnSchema>;
export type BackupGroup = z.infer<typeof groupSchema>;
export type BackupGroupMember = z.infer<typeof groupMemberSchema>;

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

export interface IdPlan {
  create: string[];
  update: string[];
  skip: string[];
}

export interface TableDiff {
  table: string;
  create: number;
  update: number;
  skip: number;
}

export function toDiff(table: string, plan: IdPlan): TableDiff {
  return { table, create: plan.create.length, update: plan.update.length, skip: plan.skip.length };
}

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

export function itemKey(kind: string, expression: string): string {
  return `${kind}\u0000${expression}`;
}

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

export interface UserReconcile {
  idMap: Map<string, string>;
  insertUserIds: Set<string>;
}

const emailKey = (email: string): string => email.trim().toLowerCase();

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

export function buildTableMergeSql(opts: {
  table: string;
  cols: readonly string[];
  userCols: readonly string[];
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
