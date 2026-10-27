import type { UserDb } from '@/lib/db/user-db';
import type { Prisma } from '@/lib/generated/prisma/client';
import {
  cleanText,
  cleanTextOrNull,
  cleanVocabTerm,
  hasKanji,
  isBlankOfMeaning,
} from '@/lib/core/text';
import { needsWork, scoreEnrichment, type QualityTier } from '@/lib/library/enrichment-quality';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import { itemLimitError, normalizeHanviet } from '@/lib/library/item-limits';
import { newSrsFields } from '@/lib/srs/srs';
import {
  migrateSettingsInput,
  parseStoredSettings,
  settingsPatchSchema,
  syncDirection,
  type Settings,
  type SettingsPatch,
} from '@/lib/settings/schema';

export async function getSettings(db: UserDb): Promise<Settings> {
  const row = await db.settings.findFirst({ orderBy: { id: 'asc' } });
  return parseStoredSettings(row?.data);
}

export async function saveSettings(db: UserDb, patch: SettingsPatch): Promise<Settings> {
  const validated = settingsPatchSchema.parse(migrateSettingsInput(patch));
  const merged = syncDirection({ ...(await getSettings(db)), ...validated });
  const data = JSON.stringify(merged);
  const existing = await db.settings.findFirst({ orderBy: { id: 'asc' } });
  if (existing) await db.settings.update({ where: { id: existing.id }, data: { data } });
  else await db.settings.create({ data: { userId: db.$ownerId(), data } });
  return merged;
}

export type VocabCaptureReason = 'misused' | 'unclear' | 'unknown';

export interface ItemInput {
  expression: string;
  meaningVi: string;
  reading?: string;
  hanviet?: string;
  level?: string;
  notes?: string;
  tags?: string[];
  captureReason?: VocabCaptureReason;
  // The shared-library entry it is taken from (phase 8, L1b).
  libraryEntryId?: string;
}

export interface AddItemsResult {
  created: number;
  skipped: { expression: string; reason: string }[];
}

export { GRAMMAR_KIND, VOCAB_KIND };

export async function addItems(
  db: UserDb,
  entries: ItemInput[],
  source = 'MCP',
  kind: string = GRAMMAR_KIND,
): Promise<AddItemsResult> {
  const result: AddItemsResult = { created: 0, skipped: [] };

  const seen = new Set<string>();
  const candidates: { expression: string; meaningVi: string; entry: ItemInput }[] = [];
  for (const entry of entries) {
    const cleaned = cleanText(entry.expression);
    const expression = kind === VOCAB_KIND ? cleanVocabTerm(cleaned) : cleaned;
    const meaningVi = cleanText(entry.meaningVi);
    // isBlankOfMeaning catches what emptiness alone misses: "（　）" and "〜" survive cleanText with
    // length > 0, and for GRAMMAR nothing strips them (cleanVocabTerm is vocab-only). Such a row
    // used to become a real library item with its own SRS schedule, so the learner got junk served
    // back to them as an exercise.
    if (!expression || isBlankOfMeaning(expression)) {
      result.skipped.push({
        expression: cleaned,
        reason: cleaned
          ? 'chỉ còn lại nhãn/ngoặc/dấu câu sau khi làm sạch — gửi lại đúng mẫu gốc'
          : 'thiếu expression hoặc meaningVi',
      });
      continue;
    }
    if (!meaningVi) {
      result.skipped.push({ expression, reason: 'thiếu expression hoặc meaningVi' });
      continue;
    }
    const tooLong = itemLimitError({
      expression,
      meaningVi,
      reading: cleanTextOrNull(entry.reading),
      hanviet: cleanTextOrNull(entry.hanviet),
    });
    if (tooLong) {
      result.skipped.push({ expression, reason: tooLong.message });
      continue;
    }
    if (seen.has(expression)) {
      result.skipped.push({ expression, reason: 'trùng trong danh sách gửi lên' });
      continue;
    }
    seen.add(expression);
    candidates.push({ expression, meaningVi, entry });
  }

  const existingRows = await db.item.findMany({
    where: { kind, expression: { in: candidates.map((c) => c.expression) } },
    select: { expression: true },
  });
  const existing = new Set(existingRows.map((r) => r.expression));

  const creates: Prisma.PrismaPromise<unknown>[] = [];
  for (const { expression, meaningVi, entry } of candidates) {
    if (existing.has(expression)) {
      result.skipped.push({ expression, reason: 'đã có trong kho' });
      continue;
    }
    const reading = hasKanji(expression) ? cleanTextOrNull(entry.reading) : null;
    creates.push(
      db.item.create({
        data: {
          userId: db.$ownerId(),
          kind,
          expression,
          reading,
          hanviet: normalizeHanviet(cleanTextOrNull(entry.hanviet)),
          meaningVi,
          level: entry.level ?? 'N5',
          notes: cleanTextOrNull(entry.notes),
          tags: entry.tags?.length ? JSON.stringify(entry.tags) : null,
          captureReason: entry.captureReason ?? null,
          libraryEntryId: entry.libraryEntryId ?? null,
          source,
          srs: { create: { ...newSrsFields(), userId: db.$ownerId() } },
        },
      }),
    );
  }

  if (creates.length > 0) await db.$transaction(creates);
  result.created = creates.length;
  return result;
}

const PENDING_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

async function autoSkipStalePending(
  db: UserDb,
  now: Date = new Date(),
  maxAgeMs: number = PENDING_MAX_AGE_MS,
): Promise<{ autoSkipped: number }> {
  const cutoff = new Date(now.getTime() - maxAgeMs);
  const result = await db.sentence.updateMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    data: { userAnswer: '(quá hạn — tự bỏ qua)', status: 'SKIPPED' },
  });
  return { autoSkipped: result.count };
}

export interface ListItemsFilter {
  level?: string;
  search?: string;
  suspended?: boolean;
  enriched?: boolean;
  quality?: QualityTier | 'needs-work';
  kind?: string;
  groupId?: string;
  withGroupIds?: boolean;
  limit?: number;
}

export async function listItems(db: UserDb, filter: ListItemsFilter = {}) {
  const items = await db.item.findMany({
    where: {
      kind: filter.kind ?? GRAMMAR_KIND,
      level: filter.level,
      suspended: filter.suspended,
      ...(filter.enriched === true ? { enrichment: { not: null } } : {}),
      ...(filter.enriched === false ? { enrichment: null } : {}),
      ...(filter.groupId ? { groups: { some: { groupId: filter.groupId } } } : {}),
      ...(filter.search
        ? {
            OR: [
              { expression: { contains: filter.search } },
              { reading: { contains: filter.search } },
              { meaningVi: { contains: filter.search } },
            ],
          }
        : {}),
    },
    include: {
      srs: {
        select: {
          state: true,
          due: true,
          reps: true,
          lapses: true,
          stability: true,
          difficulty: true,
        },
      },
      ...(filter.withGroupIds ? { groups: { select: { groupId: true } } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: filter.quality ? QUALITY_SCAN_CAP : (filter.limit ?? 50),
  });
  const scoped = filter.quality
    ? items
        .filter((i) => {
          const tier = scoreEnrichment(i.enrichment, i.kind).tier;
          return filter.quality === 'needs-work' ? needsWork(tier) : tier === filter.quality;
        })
        .slice(0, filter.limit ?? 50)
    : items;
  return scoped.map((i) => ({
    itemId: i.id,
    expression: i.expression,
    reading: i.reading,
    hanviet: i.hanviet,
    meaningVi: i.meaningVi,
    level: i.level,
    notes: i.notes,
    captureReason: i.captureReason as VocabCaptureReason | null,
    suspended: i.suspended,
    starred: i.starred,
    enrichment: i.enrichment,
    card: (({ tier, missing, v }) => ({ tier, missing, v }))(scoreEnrichment(i.enrichment, i.kind)),
    enrichedAt: i.enrichedAt,
    createdAt: i.createdAt,
    ...(filter.withGroupIds ? { groupIds: i.groups.map((g) => g.groupId) } : {}),
    srs: i.srs,
  }));
}

const QUALITY_SCAN_CAP = 500;

export async function listSentences(
  db: UserDb,
  limit = 1000,
  status?: 'PENDING' | 'GRADED' | 'SKIPPED',
) {
  await autoSkipStalePending(db);
  const sentences = await db.sentence.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      reviews: {
        select: {
          rating: true,
          role: true,
          item: { select: { expression: true, level: true } },
        },
      },
    },
  });
  return sentences.map((s) => {
    const target =
      s.reviews.find((r) => r.role === 'TARGET' && r.item) ?? s.reviews.find((r) => r.item);
    return {
      id: s.id,
      direction: s.direction,
      status: s.status,
      exerciseType: s.exerciseType,
      sourceText: s.sourceText,
      sourceRuby: s.sourceRuby,
      userAnswer: s.userAnswer,
      suggested: s.suggested,
      suggestedRuby: s.suggestedRuby,
      feedback: s.feedback,
      score: s.score,
      createdAt: s.createdAt,
      starred: s.starred,
      level: target?.item?.level ?? null,
      context: s.context,
      answeredAt: s.answeredAt,
      charCount: s.sourceText.length,
      ratings: s.reviews.map((r) => ({
        expression: r.item?.expression ?? '(đã xóa)', // item may be null after a user-initiated delete
        rating: r.rating,
        role: r.role,
      })),
    };
  });
}

export type SentenceHistoryRow = Awaited<ReturnType<typeof listSentences>>[number];

export async function setItemSuspended(db: UserDb, itemId: string, suspended: boolean) {
  await db.item.update({ where: { id: itemId }, data: { suspended } });
  return { itemId, suspended };
}

export async function setItemsSuspended(
  db: UserDb,
  ids: string[],
  suspended: boolean,
): Promise<{ affected: number }> {
  if (ids.length === 0) return { affected: 0 };
  const res = await db.item.updateMany({
    where: { id: { in: ids } },
    data: { suspended },
  });
  return { affected: res.count };
}

export async function setItemStarred(db: UserDb, itemId: string, starred: boolean) {
  await db.item.update({ where: { id: itemId }, data: { starred } });
  return { itemId, starred };
}

export async function setSentenceStarred(db: UserDb, sentenceId: string, starred: boolean) {
  await db.sentence.update({ where: { id: sentenceId }, data: { starred } });
  return { sentenceId, starred };
}

export interface UpdateItemInput {
  expression?: string;
  reading?: string | null;
  hanviet?: string | null;
  meaningVi?: string;
  notes?: string | null;
  level?: string;
}

export async function updateItem(db: UserDb, itemId: string, input: UpdateItemInput) {
  const before = await db.item.findUniqueOrThrow({
    where: { id: itemId },
    select: { expression: true, meaningVi: true, reading: true, hanviet: true },
  });
  const tooLong = itemLimitError(input, before);
  if (tooLong) throw new Error(tooLong.message);
  const data: Prisma.ItemUpdateInput = {};
  if (input.expression !== undefined) data.expression = cleanText(input.expression);
  if (input.reading !== undefined) data.reading = cleanTextOrNull(input.reading);
  if (input.hanviet !== undefined) data.hanviet = normalizeHanviet(cleanTextOrNull(input.hanviet));
  if (input.meaningVi !== undefined) data.meaningVi = cleanText(input.meaningVi);
  if (input.notes !== undefined) data.notes = cleanTextOrNull(input.notes);
  if (input.level !== undefined) data.level = input.level;
  await db.item.update({ where: { id: itemId }, data });
  return { itemId };
}

export async function deleteItem(db: UserDb, itemId: string) {
  await db.item.delete({ where: { id: itemId } });
  return { itemId };
}

export async function deleteItems(db: UserDb, ids: string[]): Promise<{ deleted: number }> {
  if (ids.length === 0) return { deleted: 0 };
  const res = await db.item.deleteMany({ where: { id: { in: ids } } });
  return { deleted: res.count };
}
