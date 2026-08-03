// The STUDENT MODEL — the one Intelligent-Tutoring-System component sakubun was missing.
//
// An ITS has four parts: a domain model, a STUDENT model, a tutor model and an interface. sakubun had
// three of them (items + enrichment cards, `lib/mcp/prompts.ts`, the web app) and reduced the fourth to
// raw FSRS numbers — "this card is due in 4 days" is scheduling, not a picture of a person. So every
// session re-derived the same conclusions about the same learner from zero, while the evidence sat in
// an append-only log nobody aggregated (plan 2026-07-26-agentic-tutor-loop §7).
//
// TWO PROPERTIES MAKE THIS DIFFERENT FROM THE STUDY PLAN THAT WAS BUILT AND DELETED (2026-07-12/14):
//  1. DERIVED, never maintained. Everything here is recomputed from `ReviewLog` + `Sentence` on every
//     read. It cannot go stale, cannot drift from reality, and the learner feeds it nothing.
//  2. PUSHED, never pulled. There is deliberately NO `get_dossier` tool. The digest rides on
//     `get_due_items` / `get_stats`, calls Claude already makes — see `lib/mcp/tools/practice.ts`.
//     A tool Claude has to REMEMBER to call is exactly what rotted last time.
//
// MINIMUM SUPPORT IS THE WHOLE DESIGN (plan risk 6). A tutor that says "you always confuse X and Y"
// after two data points is worse than a tutor with no model at all, because the learner cannot tell
// the difference between a measurement and a guess. Every aggregate below therefore carries its own
// support floor and returns `null` under it, and a learner with no history yields an EMPTY dossier
// rather than a confident-looking one.

import { prisma } from '@/lib/db';
import { parseErrorTags, type ErrorTag } from '@/lib/error-tags';
import { listLearnerNotes, type AssertedNote } from '@/lib/learner-notes';
import { minePairs, type MinedPair } from '@/lib/mining';
import { listConfusionRows } from '@/lib/practice';
import { REVIEW_STATE } from '@/lib/retention';

const DAY_MS = 86_400_000;

/** How far back the aggregates look. Matches the mining window so the two cannot disagree. */
export const DOSSIER_WINDOW_DAYS = 90;

/** Trend compares the last 30 days against the 30 before them. */
export const TREND_WINDOW_DAYS = 30;

/** Upper bound on rows pulled per query — bounded work on a call that runs once per SENTENCE. */
const SCAN_CAP = 1500;

/** Reviews an item needs before "consistently easy" is a measurement rather than a coincidence. */
export const MIN_STRONG_REVIEWS = 4;
export const MAX_STRONG = 4;

/** Items whose FIRST review was observed AND that graduated — below this the median is noise. */
export const MIN_GRADUATED_ITEMS = 5;

/** Conversation turns before a register error RATE means anything. */
export const MIN_CONVERSATION_TURNS = 10;

/** Sentences per topic, and how far above the learner's own average a topic must sit to be "best". */
export const MIN_TOPIC_SENTENCES = 3;
export const TOPIC_MARGIN_PTS = 5;
export const MAX_TOPICS = 2;

/**
 * "Best topic" is a COMPARISON, so there has to be something to compare against. With one qualifying
 * topic the claim is a tautology — the learner's only topic is trivially their best one.
 */
export const MIN_TOPICS_COMPARED = 2;

/** Misses required in EACH trend window before a direction is claimed. */
export const MIN_TREND_MISSES = 6;
export const MAX_TREND = 2;

/** Share-of-misses ratios that count as a real move rather than sampling noise. */
const TREND_IMPROVED = 0.6;
const TREND_WORSENED = 1.6;

/** Confusion pairs shown — the rest stay available to the coach, they just do not ride every turn. */
export const MAX_CONFUSIONS_SHOWN = 2;

export interface StrongPattern {
  itemId: string;
  expression: string;
  reviews: number;
  /** How many of those were rated Easy. */
  easy: number;
}

export interface ExposureProfile {
  /** This learner's median number of reviews before a pattern reaches FSRS review state. */
  median: number;
  /** Patterns the median was measured over. */
  sample: number;
}

export interface RegisterProfile {
  /** Share of CONVERSATION turns carrying a `register` error tag, 0-1. */
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
  /**
   * The ASSERTED annex — Claude's own prose observations, capped/evidence-bound/expiring
   * (`lib/learner-notes.ts`). Deliberately NOT rendered onto the per-sentence composition sheet: plan
   * risk 5 reserves the prose tier for session open, where it is paid once instead of every turn.
   */
  notes: AssertedNote[];
  /** Recurring confusion pairs — the SAME `lib/mining.ts` aggregate the coach proposes from. */
  confusions: MinedPair[];
  /** Patterns this learner has genuinely mastered: never missed, mostly rated Easy. */
  strong: StrongPattern[];
  exposures: ExposureProfile | null;
  register: RegisterProfile | null;
  topics: TopicStrength[];
  tagTrend: TagTrend[];
}

/** One review row as the aggregates need it. */
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

/**
 * True when nothing cleared its support floor. The caller renders NOTHING in that case — an empty
 * dossier must look empty, not like a learner with no weaknesses.
 */
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

/**
 * Median exposures before a pattern reaches FSRS review state, for THIS learner.
 *
 * Only counts items whose very first review is inside the window (`state === 0` on the earliest row).
 * Without that guard an item studied months ago would show its first in-window row already in review
 * state and be recorded as "graduated in 0 exposures" — a truncated window reading as a fast learner.
 */
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

/**
 * Error-tag movement, measured as a SHARE of that window's misses rather than a raw count.
 *
 * A raw count would report "particle errors improving" for a fortnight when the learner simply
 * practised less — the aggregate would be measuring attendance and calling it progress.
 */
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

/**
 * Topics where this learner writes their BEST sentences — relative to their own average, never on an
 * absolute score. Everyone's "best topic" is meaningless if every topic scores the same.
 */
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

/**
 * Compute the derived half of the student model. READ-ONLY, and it proposes nothing — this is
 * evidence, delivered so composition can AIM at a real difficulty instead of a generic tag.
 */
export async function computeDossier(userId: string, now: Date = new Date()): Promise<Dossier> {
  const since = new Date(now.getTime() - DOSSIER_WINDOW_DAYS * DAY_MS);

  const [confusionRows, notes, reviewRows, sentenceRows] = await Promise.all([
    listConfusionRows(userId, now),
    listLearnerNotes(userId, now),
    prisma.reviewLog.findMany({
      where: { userId, reviewedAt: { gte: since } },
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
      // Newest-first so a learner past the cap keeps their CURRENT history, then flipped to
      // chronological below — the exposure walk depends on the order being oldest-first.
      orderBy: { reviewedAt: 'desc' },
      take: SCAN_CAP,
    }),
    prisma.sentence.findMany({
      where: { userId, status: 'GRADED', createdAt: { gte: since }, score: { not: null } },
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
    // A log whose item was deleted still counts for trend and register (invariant #2 keeps the row),
    // but it cannot be attributed to a pattern.
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
    // "Consistently rated 4" taken literally: never missed in the window, and Easy at least half the
    // time. A pattern rated Good every time is fine — it is not a STRENGTH worth spending a slot on.
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
    // Counted per SENTENCE, not per review: one conversation turn can grade three items and would
    // otherwise weigh three times as much as a turn that graded one.
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
