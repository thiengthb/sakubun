import { prisma } from '@/lib/db/db';
import type { Prisma } from '@/lib/generated/prisma/client';
import { studyDayStart } from '@/lib/srs/select';
import {
  cleanText,
  cleanTextOrNull,
  cleanVocabTerm,
  hasKanji,
  isBlankOfMeaning,
} from '@/lib/core/text';
import { parseErrorDetail, parseErrorTags, type ErrorTag } from '@/lib/session/error-tags';
import { needsWork, scoreEnrichment, type QualityTier } from '@/lib/library/enrichment-quality';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import type { ConfusionRow } from '@/lib/library/mining';
import { type Streak, computeStreak, studyDayKey } from '@/lib/srs/streak';
import { LEECH_LAPSES, newSrsFields, SUSPEND_SUGGEST_LAPSES } from '@/lib/srs/srs';
import {
  migrateSettingsInput,
  parseStoredSettings,
  settingsPatchSchema,
  syncDirection,
  type Settings,
  type SettingsPatch,
} from '@/lib/settings/schema';

export async function getSettings(): Promise<Settings> {
  const row = await prisma.settings.findFirst({ orderBy: { id: 'asc' } });
  return parseStoredSettings(row?.data);
}

export async function saveSettings(patch: SettingsPatch): Promise<Settings> {
  const validated = settingsPatchSchema.parse(migrateSettingsInput(patch));
  const merged = syncDirection({ ...(await getSettings()), ...validated });
  const data = JSON.stringify(merged);
  const existing = await prisma.settings.findFirst({ orderBy: { id: 'asc' } });
  if (existing) await prisma.settings.update({ where: { id: existing.id }, data: { data } });
  else await prisma.settings.create({ data: { data } });
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
}

export interface AddItemsResult {
  created: number;
  skipped: { expression: string; reason: string }[];
}

export { GRAMMAR_KIND, VOCAB_KIND };

export async function addItems(
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
    if (seen.has(expression)) {
      result.skipped.push({ expression, reason: 'trùng trong danh sách gửi lên' });
      continue;
    }
    seen.add(expression);
    candidates.push({ expression, meaningVi, entry });
  }

  const existingRows = await prisma.item.findMany({
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
      prisma.item.create({
        data: {
          kind,
          expression,
          reading,
          hanviet: cleanTextOrNull(entry.hanviet),
          meaningVi,
          level: entry.level ?? 'N5',
          notes: cleanTextOrNull(entry.notes),
          tags: entry.tags?.length ? JSON.stringify(entry.tags) : null,
          captureReason: entry.captureReason ?? null,
          source,
          srs: { create: { ...newSrsFields() } },
        },
      }),
    );
  }

  if (creates.length > 0) await prisma.$transaction(creates);
  result.created = creates.length;
  return result;
}

export interface TodayCounts {
  reviews: number;
  newGrammar: number;
  sentences: number;
}

async function todayCounts(settings: Settings, now: Date = new Date()): Promise<TodayCounts> {
  const dayStart = studyDayStart(now, settings.dayCutoffHour);
  const [reviews, newGrammar, sentences] = await Promise.all([
    prisma.reviewLog.count({
      where: { reviewedAt: { gte: dayStart }, item: { kind: GRAMMAR_KIND } },
    }),
    prisma.reviewLog.count({
      where: { reviewedAt: { gte: dayStart }, state: 0, item: { kind: GRAMMAR_KIND } },
    }),
    prisma.sentence.count({ where: { createdAt: { gte: dayStart }, status: 'GRADED' } }),
  ]);
  return { reviews, newGrammar, sentences };
}

// "Due" means all four things at once: the date has passed, the card is not still NEW (state 0),
// its item is not suspended, and it is grammar. Four call sites spelled that out separately, so a
// change to what counts as due had to be found in four places.
const dueWhere = (now: Date) => ({
  due: { lte: now },
  state: { not: 0 },
  item: { suspended: false, kind: GRAMMAR_KIND },
});

const PENDING_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

async function autoSkipStalePending(
  now: Date = new Date(),
  maxAgeMs: number = PENDING_MAX_AGE_MS,
): Promise<{ autoSkipped: number }> {
  const cutoff = new Date(now.getTime() - maxAgeMs);
  const result = await prisma.sentence.updateMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    data: { userAnswer: '(quá hạn — tự bỏ qua)', status: 'SKIPPED' },
  });
  return { autoSkipped: result.count };
}

const STREAK_TTL_MS = 60_000;
let streakCache: { value: Streak; dayKey: string; at: number } | null = null;

export function invalidateStreak(): void {
  streakCache = null;
}

async function studyStreak(cutoffHour: number, now: Date): Promise<Streak> {
  const dayKey = studyDayKey(now, cutoffHour);
  const hit = streakCache;
  if (hit && hit.dayKey === dayKey && now.getTime() - hit.at < STREAK_TTL_MS) return hit.value;
  const reviewDates = await prisma.reviewLog.findMany({
    select: { reviewedAt: true },
  });
  const value = computeStreak(
    reviewDates.map((r) => studyDayKey(r.reviewedAt, cutoffHour)),
    dayKey,
  );
  streakCache = { value, dayKey, at: now.getTime() };
  return value;
}

export async function getStats(now: Date = new Date()) {
  const settings = await getSettings();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const weekAhead = new Date(now.getTime() + 7 * 86400000);
  const [totalItems, newItems, dueNow, reviews7d, dueSoon, weakRows, stateRows, suspended, today] =
    await Promise.all([
      prisma.item.count({ where: { kind: GRAMMAR_KIND } }),
      prisma.srsState.count({
        where: { state: 0, item: { suspended: false, kind: GRAMMAR_KIND } },
      }),
      prisma.srsState.count({
        where: dueWhere(now),
      }),
      prisma.reviewLog.count({ where: { reviewedAt: { gte: weekAgo } } }),
      prisma.srsState.findMany({
        where: {
          due: { gt: now, lte: weekAhead },
          state: { not: 0 },
          item: { suspended: false, kind: GRAMMAR_KIND },
        },
        select: { due: true },
      }),
      prisma.srsState.findMany({
        where: {
          reps: { gt: 0 },
          lapses: { gt: 0 },
          item: { suspended: false, kind: GRAMMAR_KIND },
        },
        include: { item: { select: { expression: true, meaningVi: true } } },
        orderBy: [{ lapses: 'desc' }, { stability: 'asc' }],
        take: 5,
      }),
      prisma.srsState.groupBy({
        by: ['state'],
        where: { item: { suspended: false, kind: GRAMMAR_KIND } },
        _count: true,
      }),
      prisma.item.count({ where: { suspended: true, kind: GRAMMAR_KIND } }),
      todayCounts(settings, now),
    ]);

  const forecast: Record<string, number> = {};
  for (const s of dueSoon) {
    const key = s.due.toISOString().slice(0, 10);
    forecast[key] = (forecast[key] ?? 0) + 1;
  }

  const byState = new Map(stateRows.map((r) => [r.state, r._count]));
  const mastery = {
    new: byState.get(0) ?? 0,
    learning: byState.get(1) ?? 0,
    review: byState.get(2) ?? 0,
    relearning: byState.get(3) ?? 0,
    suspended,
  };

  const streak = await studyStreak(settings.dayCutoffHour, now);

  const windowStart = new Date(now.getTime() - 8 * 86400000);
  const recentReviews = await prisma.reviewLog.findMany({
    where: { reviewedAt: { gte: windowStart } },
    select: { reviewedAt: true },
  });
  const dayTally = new Map<string, number>();
  for (const r of recentReviews) {
    const k = studyDayKey(r.reviewedAt, settings.dayCutoffHour);
    dayTally.set(k, (dayTally.get(k) ?? 0) + 1);
  }
  const reviewsByDay = Array.from({ length: 7 }, (_, i) => {
    const key = studyDayKey(new Date(now.getTime() - (6 - i) * 86400000), settings.dayCutoffHour);
    return { day: key.slice(5), count: dayTally.get(key) ?? 0 };
  });

  return {
    totalItems,
    newItems,
    dueNow,
    today,
    streak,
    reviewsLast7Days: reviews7d,
    dueForecast7Days: forecast,
    reviewsByDay,
    mastery,
    weakItems: weakRows.map((s) => ({
      itemId: s.itemId,
      expression: s.item.expression,
      meaningVi: s.item.meaningVi,
      lapses: s.lapses,
      reps: s.reps,
    })),
    settings,
  };
}

export type Stats = Awaited<ReturnType<typeof getStats>>;

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

export async function listItems(filter: ListItemsFilter = {}) {
  const items = await prisma.item.findMany({
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

export async function getStreak(): Promise<{ current: number; longest: number }> {
  const settings = await getSettings();
  return studyStreak(settings.dayCutoffHour, new Date());
}

const QUALITY_SCAN_CAP = 500;

const CONFUSION_WINDOW_DAYS = 90;

export async function listConfusionRows(now: Date = new Date()): Promise<ConfusionRow[]> {
  const since = new Date(now.getTime() - CONFUSION_WINDOW_DAYS * 86400000);
  const rows = await prisma.reviewLog.findMany({
    where: { reviewedAt: { gte: since }, errorDetail: { not: null } },
    select: {
      itemId: true,
      sentenceId: true,
      reviewedAt: true,
      errorDetail: true,
      item: { select: { expression: true } },
    },
    orderBy: { reviewedAt: 'desc' },
    take: 400,
  });
  return rows.map((r) => ({
    itemId: r.itemId,
    expression: r.item?.expression ?? null,
    sentenceId: r.sentenceId,
    reviewedAt: r.reviewedAt,
    confusions: parseErrorDetail(r.errorDetail),
  }));
}

export async function listSentences(limit = 1000, status?: 'PENDING' | 'GRADED' | 'SKIPPED') {
  await autoSkipStalePending();
  const sentences = await prisma.sentence.findMany({
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

export async function setItemSuspended(itemId: string, suspended: boolean) {
  await prisma.item.update({ where: { id: itemId }, data: { suspended } });
  return { itemId, suspended };
}

export async function setItemsSuspended(
  ids: string[],
  suspended: boolean,
): Promise<{ affected: number }> {
  if (ids.length === 0) return { affected: 0 };
  const res = await prisma.item.updateMany({
    where: { id: { in: ids } },
    data: { suspended },
  });
  return { affected: res.count };
}

export async function setItemStarred(itemId: string, starred: boolean) {
  await prisma.item.update({ where: { id: itemId }, data: { starred } });
  return { itemId, starred };
}

export async function setSentenceStarred(sentenceId: string, starred: boolean) {
  await prisma.sentence.update({ where: { id: sentenceId }, data: { starred } });
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

export async function updateItem(itemId: string, input: UpdateItemInput) {
  const data: Prisma.ItemUpdateInput = {};
  if (input.expression !== undefined) data.expression = cleanText(input.expression);
  if (input.reading !== undefined) data.reading = cleanTextOrNull(input.reading);
  if (input.hanviet !== undefined) data.hanviet = cleanTextOrNull(input.hanviet);
  if (input.meaningVi !== undefined) data.meaningVi = cleanText(input.meaningVi);
  if (input.notes !== undefined) data.notes = cleanTextOrNull(input.notes);
  if (input.level !== undefined) data.level = input.level;
  await prisma.item.update({ where: { id: itemId }, data });
  return { itemId };
}

export async function deleteItem(itemId: string) {
  await prisma.item.delete({ where: { id: itemId } });
  return { itemId };
}

export async function deleteItems(ids: string[]): Promise<{ deleted: number }> {
  if (ids.length === 0) return { deleted: 0 };
  const res = await prisma.item.deleteMany({ where: { id: { in: ids } } });
  return { deleted: res.count };
}

export interface WeakReport {
  windowDays: number;
  tagCounts: { tag: ErrorTag; count: number }[];
  worstItems: {
    itemId: string;
    expression: string;
    misses: number;
    tags: ErrorTag[];
  }[];
  leeches: {
    itemId: string;
    expression: string;
    meaningVi: string;
    lapses: number;
    suspendSuggested: boolean;
  }[];
}

export async function getWeakReport(now: Date = new Date(), windowDays = 30): Promise<WeakReport> {
  const since = new Date(now.getTime() - windowDays * 86400000);
  const [misses, leechRows] = await Promise.all([
    prisma.reviewLog.findMany({
      where: { reviewedAt: { gte: since }, rating: { lte: 2 }, item: { isNot: null } },
      select: {
        errorTags: true,
        itemId: true,
        item: { select: { expression: true } },
      },
    }),
    prisma.srsState.findMany({
      where: { lapses: { gte: LEECH_LAPSES }, item: { suspended: false } },
      include: { item: { select: { expression: true, meaningVi: true } } },
      orderBy: { lapses: 'desc' },
      take: 15,
    }),
  ]);

  const tagTally = new Map<ErrorTag, number>();
  const perItem = new Map<string, { expression: string; misses: number; tags: Set<ErrorTag> }>();
  for (const miss of misses) {
    if (miss.itemId == null) continue; // guarded by the `itemId not null` filter; narrows the type
    const entry = perItem.get(miss.itemId) ?? {
      expression: miss.item?.expression ?? '(đã xóa)',
      misses: 0,
      tags: new Set<ErrorTag>(),
    };
    entry.misses += 1;
    for (const tag of parseErrorTags(miss.errorTags)) {
      tagTally.set(tag, (tagTally.get(tag) ?? 0) + 1);
      entry.tags.add(tag);
    }
    perItem.set(miss.itemId, entry);
  }

  return {
    windowDays,
    tagCounts: [...tagTally.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count),
    worstItems: [...perItem.entries()]
      .map(([itemId, e]) => ({
        itemId,
        expression: e.expression,
        misses: e.misses,
        tags: [...e.tags],
      }))
      .sort((a, b) => b.misses - a.misses)
      .slice(0, 10),
    leeches: leechRows.map((s) => ({
      itemId: s.itemId,
      expression: s.item.expression,
      meaningVi: s.item.meaningVi,
      lapses: s.lapses,
      suspendSuggested: s.lapses >= SUSPEND_SUGGEST_LAPSES,
    })),
  };
}
