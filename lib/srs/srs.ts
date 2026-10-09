import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type FSRS,
  type Grade,
} from 'ts-fsrs';

export type RatingValue = 1 | 2 | 3 | 4;

const DAY_MS = 86_400_000;

export const LEECH_LAPSES = 4;
export const SUSPEND_SUGGEST_LAPSES = 8;

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
  log: { rating: RatingValue; state: number; due: Date; stability: number; difficulty: number };
}

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

export function newSrsFields(now: Date = new Date()): SrsFields {
  return fromCard(createEmptyCard(now));
}

export function retrievability(
  fields: SrsFields,
  options: { retention: number; now?: Date },
): number | null {
  if (fields.state === 0 || !fields.lastReview) return null;
  const now = options.now ?? new Date();
  return schedulerFor(options.retention).get_retrievability(toCard(fields), now, false);
}

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
