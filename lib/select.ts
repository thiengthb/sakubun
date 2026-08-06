// Practice-batch picker — decides WHICH grammar patterns go into the next sentence. Pure (no DB)
// so the policy is unit-testable; lib/practice.ts feeds it query results. Every item is a grammar
// pattern (the vocab dimension was removed 2026-07-07); vocabulary is free
// scaffolding Claude chooses at generation time, never a scheduled item.

import type { Direction, SentenceSize, Settings } from '@/lib/settings-schema';
import type { TutorCard } from '@/lib/enrichment';

/**
 * The ONE "sentence size" scale (2026-07-11): each tier derives a per-language SOURCE-sentence char
 * target AND the grammar-pattern count. Japanese 文字 pack more meaning than Vietnamese letters, so
 * ja/vi differ (≈1.6×) to feel equally long; the tutor aims within ±~30%. Pattern count rises with
 * length because a short sentence can't naturally carry many patterns (quality floor). Replaces the
 * old split SENTENCE_CHARS + settings.patternsPerSentence (replaced 2026-07-11).
 */
export const SENTENCE_SIZE_SPEC: Record<
  SentenceSize,
  { ja: number; vi: number; patterns: number }
> = {
  // ~12 文字 of budget per grammar pattern so each one has room to be used naturally (packing more
  // into ONE sentence collapses quality). VI ≈ 1.55× JA (文字 are denser). The top two tiers are
  // deliberately MULTI-SENTENCE (a short passage) — that's how you fit 6–8 patterns without cramming
  // (the protocol composes 2–4 linked sentences there); a single sentence caps at ~5 patterns.
  xshort: { ja: 12, vi: 20, patterns: 1 },
  short: { ja: 22, vi: 35, patterns: 2 },
  medium: { ja: 32, vi: 50, patterns: 3 },
  long: { ja: 46, vi: 72, patterns: 4 },
  xlong: { ja: 64, vi: 100, patterns: 5 },
  huge: { ja: 90, vi: 140, patterns: 6 }, // long compound / 2 linked sentences
  paragraph: { ja: 130, vi: 200, patterns: 8 }, // short passage, 3–4 sentences
};

// TARGET = the sentence centerpiece · SECONDARY = another scheduled grammar pattern woven in · VOCAB =
// a demand-driven vocabulary word woven in and graded on its OWN budget (never counts as a grammar slot).
export type ItemRole = 'TARGET' | 'SECONDARY' | 'VOCAB';

/**
 * Practice mode for a batch. ACQUIRE = the normal FSRS loop (due reviews + new introductions).
 * MASTERY = the acquisition queue is empty but the learner has a solid pool of graduated patterns
 * → recombine those into harder sentences instead of a dead-end "done for today". Re-drilling
 * mastered items (overlearning) has diminishing long-term returns (ERIC ED505637); spacing is what
 * retains (PMC5476736) — so mastery ESCALATES + RECOMBINES, and a miss re-activates the pattern via
 * submit_review (the weakness detector), letting FSRS re-space it.
 */
export type PracticeMode = 'ACQUIRE' | 'MASTERY';

/**
 * Minimum graduated (FSRS review-state) patterns before MASTERY mode may fire. Guards against a
 * near-empty EARLY queue (a learner who has only introduced a handful of patterns and cleared them)
 * tripping mastery prematurely — that case should still say "add more / expand levels". Not tied to
 * any JLPT level; a plain pool-size floor. Could become a setting later (A-deferred).
 */
export const MASTERY_MIN_GRADUATED = 8;

export interface ItemLite {
  id: string;
  expression: string;
  reading: string | null;
  meaningVi: string;
  level: string;
  notes: string | null;
  /** True when the item has never been reviewed (SRS state New). */
  isNew: boolean;
  /**
   * Enrichment TRIMMED to what the tutor protocol reads (`toTutorCard`), not the stored card — this
   * is re-sent to the model on every turn, so unused fields are paid for repeatedly.
   */
  enrichment?: TutorCard | null;
  /** Forget count — lapses ≥ LEECH_LAPSES marks a leech (isolation drill in the protocol). */
  lapses?: number;
}

export interface PickInput {
  /** Non-suspended patterns with due <= now, sorted most-overdue first (every level — reviews are sacred). */
  due: ItemLite[];
  /** Never-reviewed patterns, filtered to settings.grammarLevels, oldest first. */
  fresh: ItemLite[];
  /**
   * Graduated (FSRS review-state) patterns for MASTERY mode, weakest-retention first. Only supplied
   * (by lib/practice.ts) when the acquisition queue is empty AND the pool clears MASTERY_MIN_GRADUATED
   * — so its mere presence means "recombine these", no threshold logic needed here.
   */
  mastery?: ItemLite[];
  /**
   * Due VOCAB words (demand-driven), due-soonest first. Up to `settings.vocabPerSentence` are woven
   * into every sentence ALONGSIDE the grammar picks — on a separate budget, so they never reduce the
   * grammar pattern count. Present in ACQUIRE and MASTERY alike.
   */
  vocab?: ItemLite[];
  settings: Settings;
  /** Progress within the current study day (dayCutoffHour boundary). */
  today: { reviews: number; newGrammar: number; sentences: number };
  /** Override the per-sentence pattern budget (story/dialogue mode gathers more at once). */
  totalOverride?: number;
  /** Focused practice — the user explicitly asked for these patterns/levels this session. */
  focus?: {
    /** Ids of items matching the request (may overlap due/fresh — they jump the queue). */
    ids: Set<string>;
    /** Focus items already learned but NOT due — early review is fine because it was requested. */
    ahead: ItemLite[];
    /**
     * Whole-level focus ("luyện N3"): fill the sentence's SCHEDULED slots from the focus level
     * ONLY — do NOT top up with other-level due reviews. Fewer scheduled patterns is fine; the
     * tutor scaffolds naturalness with lower-level grammar (unrated, like vocab). Off for
     * pattern-focus, where a single requested pattern still needs general company.
     */
    fillFromFocusOnly?: boolean;
  };
}

export interface PickedItem extends ItemLite {
  role: ItemRole;
  /** Only in focus mode: true = user-requested pattern, false = filler added to fill the sentence. */
  focusHit?: boolean;
}

/**
 * Why a pattern the picker WANTED to serve did not make it into this batch. Every reason is fixable
 * by the learner, which is the point: a withheld pattern must be NAMED (lib/mcp/render.ts), never
 * silently dropped — the 2026-07-26 defect was a focus request returning a sheet that claimed to
 * revolve around patterns it had listed nowhere.
 */
export type WithheldReason =
  /** settings.dailyNewGrammar is spent for today (raise it, or come back tomorrow). */
  | 'daily-new-cap'
  /** settings.maxNewPerSentence is already filled by THIS sentence (it arrives in the next one). */
  | 'per-sentence-new-cap'
  /** settings.maxReviewsPerDay is spent for today. */
  | 'review-cap';

export interface WithheldItem {
  expression: string;
  reason: WithheldReason;
  /** True when the learner explicitly asked for this pattern (focus) — the loud case. */
  focusHit: boolean;
}

/** Cap on `PickedBatch.withheld` — this rides on every turn's sheet, so it must not grow unbounded. */
export const MAX_WITHHELD_REPORTED = 5;

export interface PickedBatch {
  direction: Exclude<Direction, 'ALTERNATING'>;
  /** ACQUIRE = normal loop; MASTERY = queue cleared, recombine graduated patterns (see PracticeMode). */
  mode: PracticeMode;
  items: PickedItem[];
  /** Why the batch is smaller than requested (Claude relays this to the user). */
  limits: {
    reviewLimitReached: boolean;
    newGrammarLimitReached: boolean;
    /** The per-sentence novelty cap actually bit — true only when it withheld something. */
    newPerSentenceReached: boolean;
  };
  /** Patterns the picker skipped, with the reason (capped at MAX_WITHHELD_REPORTED). */
  withheld: WithheldItem[];
}

export function resolveDirection(
  direction: Direction,
  sentencesToday: number,
): Exclude<Direction, 'ALTERNATING'> {
  if (direction !== 'ALTERNATING') return direction;
  // Bilingual mode: flip every sentence, starting with JA→VI (recognition before production).
  return sentencesToday % 2 === 0 ? 'JA_VI' : 'VI_JA';
}

export function pickBatch(input: PickInput): PickedBatch {
  const { settings, today } = input;
  const total = input.totalOverride ?? SENTENCE_SIZE_SPEC[settings.sentenceSize].patterns;

  // Weave up to settings.vocabPerSentence due VOCAB words in AFTER the grammar picks — a separate
  // budget (they never consume a grammar slot). Applied to both ACQUIRE and MASTERY batches.
  const withVocab = (grammar: PickedItem[]): PickedItem[] => {
    const cap = settings.vocabPerSentence;
    if (!input.vocab?.length || cap <= 0) return grammar;
    const vocab: PickedItem[] = input.vocab
      .slice(0, cap)
      .map((v) => ({ ...v, role: 'VOCAB' as ItemRole }));
    return [...grammar, ...vocab];
  };

  // MASTERY mode: the acquisition queue is empty FOR TODAY but a pool of graduated patterns exists →
  // recombine them into a harder sentence instead of ending the day. "Empty for today" = no due
  // reviews AND no new grammar servable — the in-level new pool is drained OR the daily new-grammar
  // cap is spent (the COMMON case: a productive day hits the cap while the store still holds patterns
  // for tomorrow). Reviews stay sacred (any due → ACQUIRE). No daily limits apply to mastery itself
  // (bonus practice PAST a cleared queue, no new introduction). The pool arrives weakest-retention
  // first, so it re-tests the shakiest mastered patterns; a miss re-activates one via submit_review.
  const newGrammarExhausted =
    input.fresh.length === 0 || today.newGrammar >= settings.dailyNewGrammar;
  if (input.mastery?.length && input.due.length === 0 && newGrammarExhausted) {
    const items: PickedItem[] = input.mastery.slice(0, total).map((item, index) => ({
      ...item,
      role: index === 0 ? 'TARGET' : 'SECONDARY',
    }));
    return {
      mode: 'MASTERY',
      direction: resolveDirection(settings.direction, today.sentences),
      items: withVocab(items),
      limits: {
        reviewLimitReached: false,
        newGrammarLimitReached: false,
        newPerSentenceReached: false,
      },
      withheld: [],
    };
  }

  let reviewsLeft = Math.max(0, settings.maxReviewsPerDay - today.reviews);
  let newGrammarLeft = Math.max(0, settings.dailyNewGrammar - today.newGrammar);
  // Per-SENTENCE novelty budget, independent of the daily one (see settings.maxNewPerSentence).
  let newPerSentenceLeft = settings.maxNewPerSentence;

  const picked: PickedItem[] = [];
  const withheld: WithheldItem[] = [];

  const focusIds = input.focus?.ids;
  const isHit = (item: ItemLite): boolean => focusIds?.has(item.id) ?? false;

  const noteWithheld = (item: ItemLite, reason: WithheldReason) => {
    if (withheld.length >= MAX_WITHHELD_REPORTED) return;
    if (withheld.some((w) => w.expression === item.expression)) return;
    withheld.push({ expression: item.expression, reason, focusHit: isHit(item) });
  };

  const blockReason = (item: ItemLite): WithheldReason | null => {
    if (!item.isNew) return reviewsLeft <= 0 ? 'review-cap' : null;
    if (newPerSentenceLeft <= 0) return 'per-sentence-new-cap';
    // An explicitly requested pattern BYPASSES the daily pace budget: the learner asking for it IS
    // the introduction decision, and silently returning nothing (the 2026-07-26 defect) loses the
    // turn — no rating, no FSRS write. The per-sentence novelty cap above still applies to it, so
    // the request is honoured one pattern at a time instead of cramming.
    if (!isHit(item) && newGrammarLeft <= 0) return 'daily-new-cap';
    return null;
  };

  const canTake = (item: ItemLite): boolean => {
    if (picked.some((p) => p.id === item.id)) return false;
    const reason = blockReason(item);
    if (reason) {
      noteWithheld(item, reason);
      return false;
    }
    return true;
  };

  const take = (item: ItemLite, role: ItemRole) => {
    picked.push({ ...item, role, ...(focusIds ? { focusHit: isHit(item) } : {}) });
    if (item.isNew) {
      // A focus hit may take newGrammarLeft negative — deliberate: it still CONSUMED a day's
      // introduction, so the counter stays honest and newGrammarLimitReached reports the truth.
      newGrammarLeft -= 1;
      newPerSentenceLeft -= 1;
    } else {
      reviewsLeft -= 1;
    }
  };

  // Focus mode: requested patterns jump the queue (due → learned-but-ahead → new), then the
  // general FSRS pool tops the sentence up to the budget ("bù mẫu khác" when the focus is small).
  const focusPool = focusIds
    ? [...input.due.filter(isHit), ...(input.focus?.ahead ?? []), ...input.fresh.filter(isHit)]
    : [];
  const generalPool = [...input.due, ...input.fresh].filter((i) => !isHit(i));
  // Whole-level focus keeps the scheduled slots pure (focus level only); otherwise the general
  // FSRS pool tops the sentence up to the pattern budget.
  const pool = input.focus?.fillFromFocusOnly ? focusPool : [...focusPool, ...generalPool];

  // TARGET = most overdue due pattern; otherwise introduce a new one. Due reviews come first (sacred).
  const target = pool.find(canTake);
  if (target) take(target, 'TARGET');

  // SECONDARY = fill with more due patterns, then fresh ones, up to the per-sentence budget.
  for (const item of pool) {
    if (picked.length >= total) break;
    if (canTake(item)) take(item, 'SECONDARY');
  }

  return {
    mode: 'ACQUIRE',
    direction: resolveDirection(settings.direction, today.sentences),
    items: withVocab(picked),
    limits: {
      reviewLimitReached: reviewsLeft <= 0,
      newGrammarLimitReached: newGrammarLeft <= 0,
      // Only true when the cap actually withheld something — a 1-new-pattern sentence at
      // maxNewPerSentence=1 is the cap being SATISFIED, not a shortfall worth reporting.
      newPerSentenceReached: withheld.some((w) => w.reason === 'per-sentence-new-cap'),
    },
    withheld,
  };
}

/** Start of the current study day (Anki-style cutoff: before dayCutoffHour belongs to yesterday). */
export function studyDayStart(now: Date, dayCutoffHour: number): Date {
  const start = new Date(now);
  start.setHours(dayCutoffHour, 0, 0, 0);
  if (start > now) start.setDate(start.getDate() - 1);
  return start;
}
