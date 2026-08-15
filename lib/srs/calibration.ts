import { hardestLevel, type JlptLevel, type Settings } from '@/lib/settings/schema';
import type { RatingValue } from '@/lib/srs/srs';

export const RATING_OUTCOME: Record<RatingValue, number> = { 1: 0, 2: 0.3, 3: 0.85, 4: 1 };

export const TARGET_SUCCESS = 0.85;

export const DEAD_BAND: readonly [number, number] = [0.75, 0.92];

export const MIN_OBSERVATIONS = 12;

export const SUCCESS_WINDOW = 20;

const ELO_SPREAD = 400;

const K_MAX = 64;
const K_MIN = 12;
const K_HALF_LIFE = 15;

export const LEVEL_RATING: Record<JlptLevel, number> = {
  N5: 1000,
  N4: 1100,
  N3: 1200,
  N2: 1300,
  N1: 1400,
};

export function initialAbility(settings: Pick<Settings, 'grammarLevels'>): number {
  return LEVEL_RATING[hardestLevel(settings.grammarLevels)];
}

export function initialChallenge(level: string): number {
  return LEVEL_RATING[level as JlptLevel] ?? LEVEL_RATING.N5;
}

export function expectedSuccess(ability: number, challenge: number): number {
  return 1 / (1 + 10 ** ((challenge - ability) / ELO_SPREAD));
}

export function dynamicK(observations: number): number {
  const n = Math.max(0, observations);
  return K_MIN + (K_MAX - K_MIN) / (1 + n / K_HALF_LIFE);
}

export const SUPPORT_OFFSET: Record<string, number> = {
  CLOZE_PRODUCTION: -120,
  GUIDED_PRODUCTION: -60,
  QUIZ: -80, // recognition, not production
  CLOZE: -60,
  TRANSLATION: 0,
  DIALOGUE: 0,
  CONVERSATION: 60, // free production PLUS situational register
  TEACH_BACK: -40,
};

export interface EloState {
  ability: number;
  challenge: number;
  abilityObservations: number;
  challengeObservations: number;
}

export interface EloUpdate {
  ability: number;
  challenge: number;
  expected: number;
  outcome: number;
}

export function updateElo(state: EloState, rating: RatingValue, exerciseType: string): EloUpdate {
  const outcome = RATING_OUTCOME[rating];
  const support = SUPPORT_OFFSET[exerciseType] ?? 0;
  const expected = expectedSuccess(state.ability, state.challenge + support);
  const surprise = outcome - expected;
  return {
    ability: state.ability + dynamicK(state.abilityObservations) * surprise,
    challenge: state.challenge - dynamicK(state.challengeObservations) * surprise,
    expected,
    outcome,
  };
}

export type AbilityAxis = 'receptive' | 'productive' | 'register';

export function axesFor(direction: string, exerciseType: string): AbilityAxis[] {
  if (exerciseType === 'CONVERSATION') return ['productive', 'register'];
  if (exerciseType === 'TEACH_BACK') return ['receptive'];
  if (exerciseType === 'QUIZ' || exerciseType === 'CLOZE') return ['receptive'];
  if (exerciseType === 'CLOZE_PRODUCTION' || exerciseType === 'GUIDED_PRODUCTION') {
    return ['productive'];
  }
  return direction === 'VI_JA' ? ['productive'] : ['receptive'];
}

export interface SuccessEstimate {
  rate: number | null;
  observations: number;
}

export function successEstimate(outcomes: readonly number[]): SuccessEstimate {
  const window = outcomes.slice(-SUCCESS_WINDOW);
  if (window.length < MIN_OBSERVATIONS) return { rate: null, observations: window.length };
  const sum = window.reduce((a, b) => a + b, 0);
  return { rate: sum / window.length, observations: window.length };
}

export interface Proposal {
  target: 'difficulty' | 'sentenceSize' | 'rung';
  direction: 'up' | 'down';
  from: string | number;
  to: string | number;
  reason: string;
  axis: AbilityAxis;
  measured: number;
}

export const RUNG_ORDER = ['CLOZE_PRODUCTION', 'GUIDED_PRODUCTION', 'TRANSLATION'] as const;
export type Rung = (typeof RUNG_ORDER)[number];

export interface ProposalInput {
  axis: AbilityAxis;
  estimate: SuccessEstimate;
  settings: Pick<Settings, 'difficulty'>;
  currentRung: Rung;
  engagementFalling: boolean;
}

export function proposeAdjustment(input: ProposalInput): Proposal | null {
  const { axis, estimate, settings, currentRung, engagementFalling } = input;
  const measured = estimate.rate;
  if (measured === null) return null; // not enough evidence — say nothing
  if (measured >= DEAD_BAND[0] && measured <= DEAD_BAND[1]) return null; // in the zone

  const pct = Math.round(measured * 100);
  const tooEasy = measured > DEAD_BAND[1];

  if (tooEasy) {
    if (engagementFalling) return null; // the veto: never push a learner who is drifting away
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
