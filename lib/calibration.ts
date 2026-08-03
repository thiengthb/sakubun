// Ability/challenge calibration — the app's estimate of what this learner can actually do, and what
// it would change about their settings. PURE (no DB, no I/O) so the policy is unit-testable and
// auditable; lib/practice.ts feeds it rows and persists what it returns.
//
// WHY Elo and not something cleverer: it "estimates both person ability and item difficulty
// simultaneously, updates immediately after a response, and requires no computationally intensive
// calculations" (ACM TOCE 3511886) — it fits SQLite and a per-turn update with no training pipeline.
// See docs/plans/2026-07-26-adaptive-calibration.md for the full reasoning and the ruled-out options.
//
// TWO HARD BOUNDARIES:
//  1. This module NEVER writes or reads FSRS scheduling. FSRS `difficulty` answers "how fast does this
//     learner forget this"; `challenge` here answers "how likely is a success at a given ability".
//     Different quantities — merging them would corrupt the scheduler (invariant 1).
//  2. It COMPUTES; it never applies. Phase 1 is shadow mode: a proposal is surfaced for the learner to
//     read, and application waits for their explicit `autoTune` opt-in (Phase 3).

import { hardestLevel, type JlptLevel, type Settings } from '@/lib/settings-schema';
import type { RatingValue } from '@/lib/srs';

// ---------------- the rating → outcome map (the sensor) ----------------

/**
 * How much "success" each FSRS rating is worth, on Elo's 0..1 outcome scale.
 *
 * Deliberately derived from RATINGS, not from Claude's `score`: the score is a fine-grained model
 * judgement that can drift with a prompt or model change, and a controller built on a drifting sensor
 * wanders. The 4-point rubric is much coarser and therefore far more stable (risk 3 in the plan).
 *
 * These four numbers are a CHOSEN PRIOR, not a measured constant — they are the first thing shadow
 * mode should be used to challenge. The one anchor that makes them interpretable: rating 3 (Good) is
 * worth 0.85, so TARGET_SUCCESS = 0.85 literally means "a typical turn lands on Good".
 */
export const RATING_OUTCOME: Record<RatingValue, number> = { 1: 0, 2: 0.3, 3: 0.85, 4: 1 };

/**
 * The setpoint the controller aims at. From the 85% Rule (Wilson et al., Nature Communications 2019):
 * optimal training error ≈ 15.87%, i.e. ~85% accuracy, which "put on a mathematical footing the
 * educational idea of a zone of proximal difficulty".
 *
 * HONEST CAVEAT (plan risk 1): that result concerns gradient-descent learners on binary/perceptual
 * tasks, not L2 grammar production. It is a defensible STARTING setpoint, not a proven law for this
 * domain — which is exactly why it is a named constant and why shadow mode comes before action.
 */
export const TARGET_SUCCESS = 0.85;

/** Act only OUTSIDE this band. Inside it the learner is where we want them; moving would be thrashing. */
export const DEAD_BAND: readonly [number, number] = [0.75, 0.92];

/** No proposal at all below this many graded observations on the axis — never act on a bad day. */
export const MIN_OBSERVATIONS = 12;

/** How many recent outcomes the success estimate looks at (a rolling window, not all history). */
export const SUCCESS_WINDOW = 20;

// ---------------- Elo ----------------

/** Elo's logistic spread. 400 = the classic scale: +400 rating ≈ 10:1 odds of success. */
const ELO_SPREAD = 400;

/** K decays as evidence accumulates: fast to find the learner, then stable. */
const K_MAX = 64;
const K_MIN = 12;
/** Observations at which K sits halfway between K_MAX and K_MIN. */
const K_HALF_LIFE = 15;

/**
 * An item's challenge starts from its JLPT level, because that is real prior information the app
 * already holds — far better than starting every item at the same number and waiting for evidence.
 */
export const LEVEL_RATING: Record<JlptLevel, number> = {
  N5: 1000,
  N4: 1100,
  N3: 1200,
  N2: 1300,
  N1: 1400,
};

/**
 * Ability starts from what the LEARNER said they are studying — `hardestLevel(grammarLevels)`.
 *
 * This is the trust model of the plan (§5) expressed as a number: the learner's own setting IS the
 * prior, so the controller begins by AGREEING with them and can only diverge as evidence accumulates.
 * A controller that starts by disagreeing with the settings page teaches the learner to distrust it.
 */
export function initialAbility(settings: Pick<Settings, 'grammarLevels'>): number {
  return LEVEL_RATING[hardestLevel(settings.grammarLevels)];
}

/** Initial challenge for an item, from its JLPT level (unknown level → N5's rating). */
export function initialChallenge(level: string): number {
  return LEVEL_RATING[level as JlptLevel] ?? LEVEL_RATING.N5;
}

/** Probability of success for an ability facing a challenge (the standard Elo expectation). */
export function expectedSuccess(ability: number, challenge: number): number {
  return 1 / (1 + 10 ** ((challenge - ability) / ELO_SPREAD));
}

/** Learning rate for the next update — high while the estimate is uncertain, low once it is settled. */
export function dynamicK(observations: number): number {
  const n = Math.max(0, observations);
  return K_MIN + (K_MAX - K_MIN) / (1 + n / K_HALF_LIFE);
}

/**
 * How much EASIER a task is because of the support it carries, in Elo points.
 *
 * This is what keeps the ability estimate honest across the production ladder: a correct answer with
 * the pattern slot pre-written is much weaker evidence of production ability than the same answer
 * composed from nothing. Without this offset, scaffolded wins would inflate `abilityProductive` and
 * the controller would push the learner up a ladder they have not actually climbed — the same shape
 * of error as capping an assisted rating at 3 (see PRODUCTION_LADDER in lib/mcp/prompts.ts).
 */
export const SUPPORT_OFFSET: Record<string, number> = {
  CLOZE_PRODUCTION: -120,
  GUIDED_PRODUCTION: -60,
  QUIZ: -80, // recognition, not production
  CLOZE: -60,
  TRANSLATION: 0,
  DIALOGUE: 0,
  CONVERSATION: 60, // free production PLUS situational register
  // Explaining a pattern in the L1: no Japanese form, particle or word-order burden (so easier than
  // an unaided translation), but nothing to recognise from either (so harder than picking A-D).
  // Placed between the two on that reasoning rather than measured — the Elo path itself will revise
  // the item side; this offset is the prior.
  TEACH_BACK: -40,
};

export interface EloState {
  ability: number;
  challenge: number;
  /** Graded observations behind `ability` (drives K). */
  abilityObservations: number;
  /** Graded observations behind `challenge` (drives its own K). */
  challengeObservations: number;
}

export interface EloUpdate {
  ability: number;
  challenge: number;
  expected: number;
  outcome: number;
}

/**
 * One Elo "match": the learner vs one item, for one graded rating. Ability rises when the outcome
 * beats expectation and the item's challenge falls by the same surprise — that symmetry is what lets
 * item difficulty be discovered instead of declared.
 */
export function updateElo(state: EloState, rating: RatingValue, exerciseType: string): EloUpdate {
  const outcome = RATING_OUTCOME[rating];
  const support = SUPPORT_OFFSET[exerciseType] ?? 0;
  // The learner faces the EFFECTIVE task, not the bare item: support makes the same item easier.
  const expected = expectedSuccess(state.ability, state.challenge + support);
  const surprise = outcome - expected;
  return {
    ability: state.ability + dynamicK(state.abilityObservations) * surprise,
    challenge: state.challenge - dynamicK(state.challengeObservations) * surprise,
    expected,
    outcome,
  };
}

// ---------------- which ability a turn is evidence for ----------------

export type AbilityAxis = 'receptive' | 'productive' | 'register';

/**
 * Which ability axes a turn is evidence for. The receptive/productive split is not a nicety: L2
 * "receptive vocabulary knowledge is larger than productive knowledge", so one number cannot describe
 * a learner who reads N3 and produces N4 — which is the exact complaint that started this plan.
 */
export function axesFor(direction: string, exerciseType: string): AbilityAxis[] {
  if (exerciseType === 'CONVERSATION') return ['productive', 'register'];
  // Teach-back is METALINGUISTIC knowledge, and its answer is Vietnamese — no Japanese is produced,
  // so counting it as productive evidence would credit an ability the turn never exercised.
  if (exerciseType === 'TEACH_BACK') return ['receptive'];
  if (exerciseType === 'QUIZ' || exerciseType === 'CLOZE') return ['receptive'];
  if (exerciseType === 'CLOZE_PRODUCTION' || exerciseType === 'GUIDED_PRODUCTION') {
    return ['productive'];
  }
  return direction === 'VI_JA' ? ['productive'] : ['receptive'];
}

// ---------------- the success estimate ----------------

export interface SuccessEstimate {
  /** Mean outcome over the window, or null when there is not enough evidence to say anything. */
  rate: number | null;
  observations: number;
}

/**
 * Rolling mean outcome over the most recent turns. Returns `null` rather than a default when evidence
 * is thin: an empty history must yield NO estimate, because a confident-looking number derived from
 * two data points is worse than admitting we do not know (plan risk 6).
 */
export function successEstimate(outcomes: readonly number[]): SuccessEstimate {
  const window = outcomes.slice(-SUCCESS_WINDOW);
  if (window.length < MIN_OBSERVATIONS) return { rate: null, observations: window.length };
  const sum = window.reduce((a, b) => a + b, 0);
  return { rate: sum / window.length, observations: window.length };
}

// ---------------- the proposal ----------------

/** What the controller would change. `null` from `proposeAdjustment` = leave everything alone. */
export interface Proposal {
  /** The setting to move, or 'rung' for the per-sentence support level (not a stored setting). */
  target: 'difficulty' | 'sentenceSize' | 'rung';
  direction: 'up' | 'down';
  /** Current value, for the narration. */
  from: string | number;
  /** Proposed value. */
  to: string | number;
  /** ONE plain sentence, learner-facing (Vietnamese) — Bjork predicts correct calibration FEELS worse,
   * so an unexplained change reads as the app malfunctioning. */
  reason: string;
  /** The axis whose evidence triggered it, for auditability. */
  axis: AbilityAxis;
  /** The measured success rate that triggered it. */
  measured: number;
}

/** Support rungs, easiest first — 'rung' proposals step along this. */
export const RUNG_ORDER = ['CLOZE_PRODUCTION', 'GUIDED_PRODUCTION', 'TRANSLATION'] as const;
export type Rung = (typeof RUNG_ORDER)[number];

export interface ProposalInput {
  axis: AbilityAxis;
  estimate: SuccessEstimate;
  settings: Pick<Settings, 'difficulty'>;
  /** The support rung the learner is currently practising production at. */
  currentRung: Rung;
  /**
   * Engagement guard: is the learner's activity FALLING? A falling learner never gets a harder
   * exercise — a learner who quits retains nothing, so engagement is a hard constraint (a veto), and
   * never the target (chasing comfort tunes toward too-easy, which is the N5-drag failure).
   */
  engagementFalling: boolean;
}

/**
 * At most ONE change, at most ONE step. Returns null unless every rail is satisfied.
 *
 * Rails, each mapping to a specific failure mode: enough evidence (not a bad day) · outside the dead
 * band (not noise) · one setting and one step (so the learner can attribute the change) · never raise
 * difficulty while engagement falls (the learner-quits failure) · a reason the learner can read.
 */
export function proposeAdjustment(input: ProposalInput): Proposal | null {
  const { axis, estimate, settings, currentRung, engagementFalling } = input;
  const measured = estimate.rate;
  if (measured === null) return null; // not enough evidence — say nothing
  if (measured >= DEAD_BAND[0] && measured <= DEAD_BAND[1]) return null; // in the zone

  const pct = Math.round(measured * 100);
  const tooEasy = measured > DEAD_BAND[1];

  if (tooEasy) {
    if (engagementFalling) return null; // the veto: never push a learner who is drifting away
    // Prefer climbing the production ladder over raising abstract structural difficulty: it is the
    // change the learner actually feels, and the one this whole plan exists to make possible.
    const rungIndex = RUNG_ORDER.indexOf(currentRung);
    if (axis === 'productive' && rungIndex < RUNG_ORDER.length - 1) {
      return {
        target: 'rung',
        direction: 'up',
        from: currentRung,
        to: RUNG_ORDER[rungIndex + 1],
        axis,
        measured,
        reason: `Bạn đang đúng ${pct}% ở dạng có trợ giúp — thử bớt khung một bậc cho vừa sức hơn.`,
      };
    }
    if (settings.difficulty >= 5) return null; // already at the top; nothing to step
    return {
      target: 'difficulty',
      direction: 'up',
      from: settings.difficulty,
      to: settings.difficulty + 1,
      axis,
      measured,
      reason: `Bạn đang đúng ${pct}% — nâng độ phức tạp câu lên một bậc để không bị nhàm.`,
    };
  }

  // Too hard. Dropping a rung is always preferred over lowering `difficulty`: it is reversible
  // per-sentence and it does not narrow what the learner is exposed to.
  const rungIndex = RUNG_ORDER.indexOf(currentRung);
  if (axis === 'productive' && rungIndex > 0) {
    return {
      target: 'rung',
      direction: 'down',
      from: currentRung,
      to: RUNG_ORDER[rungIndex - 1],
      axis,
      measured,
      reason: `Bạn đang đúng ${pct}% khi tự dịch sang Nhật — thêm khung gợi ý một bậc, rồi bỏ dần.`,
    };
  }
  if (settings.difficulty <= 1) return null;
  return {
    target: 'difficulty',
    direction: 'down',
    from: settings.difficulty,
    to: settings.difficulty - 1,
    axis,
    measured,
    reason: `Bạn đang đúng ${pct}% — hạ độ phức tạp câu một bậc để lấy lại đà.`,
  };
}
