// FSRS wrapper — the ONLY scheduler in the app. Pure functions over plain field objects so the
// engine is unit-testable without a database; Prisma rows map 1:1 onto SrsFields.

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type FSRS,
  type Grade,
} from 'ts-fsrs';

/** Anki-style review signal: 1 Again · 2 Hard · 3 Good · 4 Easy. */
export type RatingValue = 1 | 2 | 3 | 4;

const DAY_MS = 86_400_000;

/** An item this forgotten needs isolation drills (Anki flags leeches; we start earlier). */
export const LEECH_LAPSES = 4;
/** At Anki's default leech threshold, suggest suspending instead of grinding. */
export const SUSPEND_SUGGEST_LAPSES = 8;

/** Mirrors the SrsState Prisma model (and ts-fsrs Card). */
export interface SrsFields {
  due: Date;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
}

export interface RateResult {
  next: SrsFields;
  /** Values for the append-only ReviewLog row (due/stability/difficulty AFTER the review). */
  log: { rating: RatingValue; state: number; due: Date; stability: number; difficulty: number };
}

// One FSRS instance per retention value (settings.desiredRetention rarely changes).
const schedulers = new Map<number, FSRS>();

function schedulerFor(retention: number): FSRS {
  const cached = schedulers.get(retention);
  if (cached) return cached;
  const scheduler = fsrs(generatorParameters({ request_retention: retention }));
  schedulers.set(retention, scheduler);
  return scheduler;
}

function toCard(fields: SrsFields): Card {
  return {
    due: fields.due,
    stability: fields.stability,
    difficulty: fields.difficulty,
    elapsed_days: 0, // deprecated in ts-fsrs v5, required by the Card shape
    scheduled_days: fields.scheduledDays,
    learning_steps: fields.learningSteps,
    reps: fields.reps,
    lapses: fields.lapses,
    state: fields.state,
    last_review: fields.lastReview ?? undefined,
  };
}

function fromCard(card: Card): SrsFields {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ?? null,
  };
}

/** Fresh FSRS state for a newly added item (due immediately). */
export function newSrsFields(now: Date = new Date()): SrsFields {
  return fromCard(createEmptyCard(now));
}

/**
 * Current recall probability (0–1) per the FSRS forgetting curve, given time elapsed since the last
 * review. New / never-reviewed cards return null (there is no curve yet). Higher = more likely still
 * remembered right now. Read-only — used by the per-item analytics page, never by the scheduler.
 */
export function retrievability(
  fields: SrsFields,
  options: { retention: number; now?: Date },
): number | null {
  if (fields.state === 0 || !fields.lastReview) return null;
  const now = options.now ?? new Date();
  return schedulerFor(options.retention).get_retrievability(toCard(fields), now, false);
}

/**
 * Sample the forgetting curve from the last review up to a little past the due date — a series of
 * {day, r} points for the detail-page chart (day = days since lastReview, r = recall probability
 * 0–1). Empty for new / never-reviewed cards. `end` extends 20% beyond due so the curve shows the
 * dip the scheduler is chasing, not just the flat pre-due stretch.
 */
export function forgettingCurve(
  fields: SrsFields,
  options: { retention: number; samples?: number },
): { day: number; r: number }[] {
  if (fields.state === 0 || !fields.lastReview) return [];
  const last = fields.lastReview.getTime();
  const span = Math.max(fields.due.getTime() - last, DAY_MS); // ≥1 day so a same-day due isn't degenerate
  const end = last + span * 1.2;
  const scheduler = schedulerFor(options.retention);
  const card = toCard(fields);
  const n = options.samples ?? 24;
  const points: { day: number; r: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = last + ((end - last) * i) / n;
    points.push({
      day: (t - last) / DAY_MS,
      r: scheduler.get_retrievability(card, new Date(t), false),
    });
  }
  return points;
}

/** Apply one review signal and return the next state + the log row values. */
export function rateOnce(
  fields: SrsFields,
  rating: RatingValue,
  options: { retention: number; now?: Date },
): RateResult {
  const now = options.now ?? new Date();
  const { card } = schedulerFor(options.retention).next(toCard(fields), now, rating as Grade);
  const next = fromCard(card);
  return {
    next,
    log: {
      rating,
      state: fields.state, // state at review time (0 = the item's first-ever review)
      due: next.due,
      stability: next.stability,
      difficulty: next.difficulty,
    },
  };
}
