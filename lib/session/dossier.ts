import { prisma } from '@/lib/db/db';
import { parseErrorTags, type ErrorTag } from '@/lib/session/error-tags';
import { listLearnerNotes, type AssertedNote } from '@/lib/session/learner-notes';
import { minePairs, type MinedPair } from '@/lib/library/mining';
import { listConfusionRows } from '@/lib/library/practice';
import { REVIEW_STATE } from '@/lib/srs/retention';

const DAY_MS = 86_400_000;

export const DOSSIER_WINDOW_DAYS = 90;

export const TREND_WINDOW_DAYS = 30;

const SCAN_CAP = 1500;

export const MIN_STRONG_REVIEWS = 4;
export const MAX_STRONG = 4;

export const MIN_GRADUATED_ITEMS = 5;

export const MIN_CONVERSATION_TURNS = 10;

export const MIN_TOPIC_SENTENCES = 3;
export const TOPIC_MARGIN_PTS = 5;
export const MAX_TOPICS = 2;

export const MIN_TOPICS_COMPARED = 2;

export const MIN_TREND_MISSES = 6;
export const MAX_TREND = 2;

const TREND_IMPROVED = 0.6;
const TREND_WORSENED = 1.6;

export const MAX_CONFUSIONS_SHOWN = 2;

export interface StrongPattern {
  itemId: string;
  expression: string;
  reviews: number;
  easy: number;
}

export interface ExposureProfile {
  median: number;
  sample: number;
}

export interface RegisterProfile {
  rate: number;
  turns: number;
}

export interface TopicStrength {
  context: string;
  avgScore: number;
  sentences: number;
}

export type TrendDirection = 'improving' | 'stuck' | 'worsening';

export interface TagTrend {
  tag: ErrorTag;
  recent: number;
  prior: number;
  direction: TrendDirection;
}

export interface Dossier {
  windowDays: number;
  notes: AssertedNote[];
  confusions: MinedPair[];
  strong: StrongPattern[];
  exposures: ExposureProfile | null;
  register: RegisterProfile | null;
  topics: TopicStrength[];
  tagTrend: TagTrend[];
}

interface Log {
  itemId: string | null;
  expression: string | null;
  sentenceId: string | null;
  exerciseType: string | null;
  rating: number;
  state: number;
  reviewedAt: Date;
  tags: ErrorTag[];
}

export function isEmptyDossier(d: Dossier): boolean {
  return (
    d.notes.length === 0 &&
    d.confusions.length === 0 &&
    d.strong.length === 0 &&
    d.exposures === null &&
    d.register === null &&
    d.topics.length === 0 &&
    d.tagTrend.length === 0
  );
}

function exposuresToGraduation(byItem: Map<string, Log[]>): ExposureProfile | null {
  const counts: number[] = [];
  for (const logs of byItem.values()) {
    if (logs[0]?.state !== 0) continue;
    const idx = logs.findIndex((l) => l.state === REVIEW_STATE);
    if (idx <= 0) continue; // never graduated inside the window
    counts.push(idx);
  }
  if (counts.length < MIN_GRADUATED_ITEMS) return null;
  counts.sort((a, b) => a - b);
  const mid = Math.floor(counts.length / 2);
  const median = counts.length % 2 === 1 ? counts[mid] : (counts[mid - 1] + counts[mid]) / 2;
  return { median: Math.round(median * 10) / 10, sample: counts.length };
}

function tagTrends(logs: readonly Log[], now: Date): TagTrend[] {
  const recentFrom = now.getTime() - TREND_WINDOW_DAYS * DAY_MS;
  const priorFrom = now.getTime() - 2 * TREND_WINDOW_DAYS * DAY_MS;

  const recent = new Map<ErrorTag, number>();
  const prior = new Map<ErrorTag, number>();
  let recentMisses = 0;
  let priorMisses = 0;

  for (const log of logs) {
    if (log.rating > 2) continue;
    const at = log.reviewedAt.getTime();
    const bucket = at >= recentFrom ? recent : at >= priorFrom ? prior : null;
    if (!bucket) continue;
    if (bucket === recent) recentMisses += 1;
    else priorMisses += 1;
    for (const tag of log.tags) bucket.set(tag, (bucket.get(tag) ?? 0) + 1);
  }
  if (recentMisses < MIN_TREND_MISSES || priorMisses < MIN_TREND_MISSES) return [];

  const out: TagTrend[] = [];
  for (const [tag, priorCount] of prior) {
    const recentCount = recent.get(tag) ?? 0;
    if (priorCount + recentCount < MIN_TREND_MISSES) continue;
    const ratio = recentCount / recentMisses / (priorCount / priorMisses);
    const direction: TrendDirection =
      ratio <= TREND_IMPROVED ? 'improving' : ratio >= TREND_WORSENED ? 'worsening' : 'stuck';
    out.push({ tag, recent: recentCount, prior: priorCount, direction });
  }
  return out.sort((a, b) => b.recent + b.prior - (a.recent + a.prior)).slice(0, MAX_TREND);
}

function bestTopics(
  rows: readonly { context: string | null; score: number | null }[],
): TopicStrength[] {
  const byTopic = new Map<string, { total: number; n: number }>();
  let overallTotal = 0;
  let overallN = 0;
  for (const row of rows) {
    const context = row.context?.trim();
    if (!context || row.score == null) continue;
    const entry = byTopic.get(context) ?? { total: 0, n: 0 };
    entry.total += row.score;
    entry.n += 1;
    byTopic.set(context, entry);
    overallTotal += row.score;
    overallN += 1;
  }
  if (overallN === 0) return [];
  const qualifying = [...byTopic.entries()].filter(([, e]) => e.n >= MIN_TOPIC_SENTENCES);
  if (qualifying.length < MIN_TOPICS_COMPARED) return [];
  const overallAvg = overallTotal / overallN;
  return qualifying
    .filter(([, e]) => e.total / e.n >= overallAvg + TOPIC_MARGIN_PTS)
    .map(([context, e]) => ({
      context,
      avgScore: Math.round(e.total / e.n),
      sentences: e.n,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, MAX_TOPICS);
}

export async function computeDossier(now: Date = new Date()): Promise<Dossier> {
  const since = new Date(now.getTime() - DOSSIER_WINDOW_DAYS * DAY_MS);

  const [confusionRows, notes, reviewRows, sentenceRows] = await Promise.all([
    listConfusionRows(now),
    listLearnerNotes(now),
    prisma.reviewLog.findMany({
      where: { reviewedAt: { gte: since } },
      select: {
        itemId: true,
        sentenceId: true,
        rating: true,
        state: true,
        reviewedAt: true,
        errorTags: true,
        item: { select: { expression: true } },
        sentence: { select: { exerciseType: true } },
      },
      orderBy: { reviewedAt: 'desc' },
      take: SCAN_CAP,
    }),
    prisma.sentence.findMany({
      where: { status: 'GRADED', createdAt: { gte: since }, score: { not: null } },
      select: { context: true, score: true },
      orderBy: { createdAt: 'desc' },
      take: SCAN_CAP,
    }),
  ]);

  const logs: Log[] = reviewRows
    .map((r) => ({
      itemId: r.itemId,
      expression: r.item?.expression ?? null,
      sentenceId: r.sentenceId,
      exerciseType: r.sentence?.exerciseType ?? null,
      rating: r.rating,
      state: r.state,
      reviewedAt: r.reviewedAt,
      tags: parseErrorTags(r.errorTags),
    }))
    .reverse();

  const byItem = new Map<string, Log[]>();
  for (const log of logs) {
    if (!log.itemId) continue;
    const list = byItem.get(log.itemId);
    if (list) list.push(log);
    else byItem.set(log.itemId, [log]);
  }

  const strong: StrongPattern[] = [...byItem.entries()]
    .map(([itemId, list]) => ({
      itemId,
      expression: list.at(-1)?.expression ?? '',
      reviews: list.length,
      easy: list.filter((l) => l.rating === 4).length,
      missed: list.some((l) => l.rating <= 2),
    }))
    .filter(
      (s) =>
        s.expression && s.reviews >= MIN_STRONG_REVIEWS && !s.missed && s.easy * 2 >= s.reviews,
    )
    .sort((a, b) => b.easy - a.easy || b.reviews - a.reviews)
    .slice(0, MAX_STRONG)
    .map(({ itemId, expression, reviews, easy }) => ({ itemId, expression, reviews, easy }));

  const conversationTurns = new Set<string>();
  const registerTurns = new Set<string>();
  for (const log of logs) {
    if (log.exerciseType !== 'CONVERSATION' || !log.sentenceId) continue;
    conversationTurns.add(log.sentenceId);
    if (log.tags.includes('register')) registerTurns.add(log.sentenceId);
  }

  return {
    windowDays: DOSSIER_WINDOW_DAYS,
    notes,
    confusions: minePairs(confusionRows, now).slice(0, MAX_CONFUSIONS_SHOWN),
    strong,
    exposures: exposuresToGraduation(byItem),
    register:
      conversationTurns.size >= MIN_CONVERSATION_TURNS
        ? {
            rate: Math.round((registerTurns.size / conversationTurns.size) * 100) / 100,
            turns: conversationTurns.size,
          }
        : null,
    topics: bestTopics(sentenceRows),
    tagTrend: tagTrends(logs, now),
  };
}
