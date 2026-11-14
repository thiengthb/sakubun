import { KANJI_KIND } from '@/lib/library/item-kinds';
import { studyDayKey } from '@/lib/srs/streak';

// The pure half of the Hôm nay page (plan 2026-11-14-u3-today, U3a): what its lead area says,
// how long the cards should take, the week strip, the most missed items and the 14-day forecast.

const DAY_MS = 86_400_000;
/** Two reviews further apart than this belong to different sittings, so the gap says nothing. */
export const SITTING_GAP_MS = 2 * 60_000;
/** Below this many gaps the median is noise: assume a flat pace instead. */
export const MIN_GAPS = 20;
export const DEFAULT_SEC_PER_CARD = 30;

/** Seconds one card takes: the median gap between back-to-back reviews in one sitting. */
export function secondsPerCard(reviewedAt: readonly Date[]): number {
  const times = reviewedAt.map((d) => d.getTime()).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (gap > 0 && gap < SITTING_GAP_MS) gaps.push(gap);
  }
  if (gaps.length < MIN_GAPS) return DEFAULT_SEC_PER_CARD;
  gaps.sort((a, b) => a - b);
  const mid = gaps.length >> 1;
  const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  return median / 1000;
}

/** Whole minutes for `cards` cards, rounded up; at least one when there is anything to do. */
export function estimateMinutes(cards: number, secPerCard: number): number {
  if (cards <= 0) return 0;
  return Math.max(1, Math.ceil((cards * secPerCard) / 60));
}

export interface ReadyCards {
  /** Started cards waiting now: learning steps and due reviews. */
  due: number;
  newGrammar: number;
  newVocab: number;
  newKanji: number;
}

export type TodayHero =
  /**
   * No grammar or words yet: the lead area asks for a level (U3c). `kanjiWaiting` counts the kanji
   * cards Ôn nhanh already made that are ready now, so they are not hidden behind the level pick.
   */
  | { kind: 'empty'; kanjiWaiting: number }
  /**
   * Cards to study; `resume` once the learner has already studied today ("Học tiếp"), and
   * `reviewedToday` says how many cards that was (each card once).
   */
  | ({
      kind: 'ready';
      total: number;
      minutes: number;
      resume: boolean;
      reviewedToday: number;
    } & ReadyCards)
  /**
   * Nothing left for today. `reviewedToday` tells praise for finishing apart from a day with
   * nothing due; `nextDueAt` is when the next card comes, if any is scheduled.
   */
  | { kind: 'done'; reviewedToday: number; nextDueAt: Date | null };

export function todayHero(input: {
  libraryEmpty: boolean;
  ready: ReadyCards;
  /** Kanji cards that exist and are ready now; read only when the library is empty. */
  kanjiWaiting?: number;
  reviewedToday: number;
  secPerCard: number;
  nextDueAt: Date | null;
}): TodayHero {
  if (input.libraryEmpty) return { kind: 'empty', kanjiWaiting: input.kanjiWaiting ?? 0 };
  const { ready } = input;
  const total = ready.due + ready.newGrammar + ready.newVocab + ready.newKanji;
  if (total === 0)
    return { kind: 'done', reviewedToday: input.reviewedToday, nextDueAt: input.nextDueAt };
  return {
    kind: 'ready',
    ...ready,
    total,
    minutes: estimateMinutes(total, input.secPerCard),
    resume: input.reviewedToday > 0,
    reviewedToday: input.reviewedToday,
  };
}

export interface WeekDay {
  day: string;
  studied: boolean;
  today: boolean;
  future: boolean;
}

/** Monday to Sunday of the study week holding `now`, each marked studied or not. */
export function studyWeek(reviewedAt: readonly Date[], now: Date, cutoffHour: number): WeekDay[] {
  const studied = new Set(reviewedAt.map((d) => studyDayKey(d, cutoffHour)));
  const todayKey = studyDayKey(now, cutoffHour);
  // Noon of the study day keeps the steps below clear of the cutoff hour and of DST shifts.
  const [y, m, d] = todayKey.split('-').map(Number);
  const noon = new Date(y, m - 1, d, 12);
  const sinceMonday = (noon.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(noon);
    date.setDate(noon.getDate() - sinceMonday + i);
    const day = studyDayKey(date, 0);
    return { day, studied: studied.has(day), today: day === todayKey, future: day > todayKey };
  });
}

export interface MissLog {
  itemId: string | null;
  expression: string | null;
  kind: string | null;
  rating: number;
}

export interface MissedItem {
  itemId: string;
  expression: string;
  misses: number;
}

/** Items missed (Again or Hard) at least twice, most first; kanji cards have no item page. */
export function mostMissed(logs: readonly MissLog[], limit = 3): MissedItem[] {
  const tally = new Map<string, MissedItem>();
  for (const log of logs) {
    if (log.rating > 2 || log.itemId == null || log.kind === KANJI_KIND) continue;
    const entry = tally.get(log.itemId) ?? {
      itemId: log.itemId,
      expression: log.expression ?? '',
      misses: 0,
    };
    entry.misses += 1;
    tally.set(log.itemId, entry);
  }
  return [...tally.values()]
    .filter((e) => e.misses >= 2)
    .sort((a, b) => b.misses - a.misses)
    .slice(0, limit);
}

/** The end (exclusive) of the forecast: midnight UTC after its last day, for the query to stop at. */
export function forecastEnd(now: Date, days = 14): Date {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(start + days * DAY_MS);
}

/**
 * Cards coming due on each of the next `days` days, bucketed by UTC day as on Phân tích: today and
 * the 13 days after, up to `forecastEnd`. A card counts when its day is one of the buckets.
 */
export function forecast(
  dues: readonly Date[],
  now: Date,
  days = 14,
): { day: string; count: number }[] {
  const buckets = Array.from({ length: days }, (_, i) =>
    new Date(now.getTime() + i * DAY_MS).toISOString().slice(0, 10),
  );
  const tally = new Map(buckets.map((day) => [day, 0]));
  for (const due of dues) {
    if (due.getTime() <= now.getTime()) continue;
    const key = due.toISOString().slice(0, 10);
    if (tally.has(key)) tally.set(key, tally.get(key)! + 1);
  }
  return buckets.map((day) => ({ day, count: tally.get(day)! }));
}
