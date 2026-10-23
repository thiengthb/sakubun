import {
  legacyDirection,
  type Direction,
  type SentenceSize,
  type Settings,
} from '@/lib/settings/schema';
import type { TutorCard } from '@/lib/library/enrichment';

export const SENTENCE_SIZE_SPEC: Record<
  SentenceSize,
  { ja: number; vi: number; patterns: number }
> = {
  xshort: { ja: 12, vi: 20, patterns: 1 },
  short: { ja: 22, vi: 35, patterns: 2 },
  medium: { ja: 32, vi: 50, patterns: 3 },
  long: { ja: 46, vi: 72, patterns: 4 },
  xlong: { ja: 64, vi: 100, patterns: 5 },
  huge: { ja: 90, vi: 140, patterns: 6 }, // long compound / 2 linked sentences
  paragraph: { ja: 130, vi: 200, patterns: 8 }, // short passage, 3–4 sentences
};

export type ItemRole = 'TARGET' | 'SECONDARY' | 'VOCAB';

export type PracticeMode = 'ACQUIRE' | 'MASTERY';

export const MASTERY_MIN_GRADUATED = 8;

export interface ItemLite {
  id: string;
  expression: string;
  reading: string | null;
  meaningVi: string;
  level: string;
  notes: string | null;
  isNew: boolean;
  enrichment?: TutorCard | null;
  lapses?: number;
}

export interface PickInput {
  due: ItemLite[];
  fresh: ItemLite[];
  mastery?: ItemLite[];
  vocab?: ItemLite[];
  settings: Settings;
  today: { reviews: number; newGrammar: number; sentences: number };
  totalOverride?: number;
  focus?: {
    ids: Set<string>;
    ahead: ItemLite[];
    fillFromFocusOnly?: boolean;
  };
}

export interface PickedItem extends ItemLite {
  role: ItemRole;
  focusHit?: boolean;
}

export type WithheldReason = 'daily-new-cap' | 'per-sentence-new-cap' | 'review-cap';

export interface WithheldItem {
  expression: string;
  reason: WithheldReason;
  focusHit: boolean;
}

export const MAX_WITHHELD_REPORTED = 5;

export interface PickedBatch {
  direction: Exclude<Direction, 'ALTERNATING'>;
  mode: PracticeMode;
  items: PickedItem[];
  limits: {
    reviewLimitReached: boolean;
    newGrammarLimitReached: boolean;
    newPerSentenceReached: boolean;
  };
  withheld: WithheldItem[];
}

export function resolveDirection(
  direction: Direction,
  sentencesToday: number,
): Exclude<Direction, 'ALTERNATING'> {
  if (direction !== 'ALTERNATING') return direction;
  return sentencesToday % 2 === 0 ? 'JA_VI' : 'VI_JA';
}

export function pickBatch(input: PickInput): PickedBatch {
  const { settings, today } = input;
  const total = input.totalOverride ?? SENTENCE_SIZE_SPEC[settings.sentenceSize].patterns;

  const withVocab = (grammar: PickedItem[]): PickedItem[] => {
    const cap = settings.vocabPerSentence;
    if (!input.vocab?.length || cap <= 0) return grammar;
    const vocab: PickedItem[] = input.vocab
      .slice(0, cap)
      .map((v) => ({ ...v, role: 'VOCAB' as ItemRole }));
    return [...grammar, ...vocab];
  };

  const newGrammarExhausted =
    input.fresh.length === 0 || today.newGrammar >= settings.dailyNewGrammar;
  if (input.mastery?.length && input.due.length === 0 && newGrammarExhausted) {
    const items: PickedItem[] = input.mastery.slice(0, total).map((item, index) => ({
      ...item,
      role: index === 0 ? 'TARGET' : 'SECONDARY',
    }));
    return {
      mode: 'MASTERY',
      direction: resolveDirection(legacyDirection(settings), today.sentences),
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
      newGrammarLeft -= 1;
      newPerSentenceLeft -= 1;
    } else {
      reviewsLeft -= 1;
    }
  };

  const focusPool = focusIds
    ? [...input.due.filter(isHit), ...(input.focus?.ahead ?? []), ...input.fresh.filter(isHit)]
    : [];
  const generalPool = [...input.due, ...input.fresh].filter((i) => !isHit(i));
  const pool = input.focus?.fillFromFocusOnly ? focusPool : [...focusPool, ...generalPool];

  const target = pool.find(canTake);
  if (target) take(target, 'TARGET');

  for (const item of pool) {
    if (picked.length >= total) break;
    if (canTake(item)) take(item, 'SECONDARY');
  }

  return {
    mode: 'ACQUIRE',
    direction: resolveDirection(legacyDirection(settings), today.sentences),
    items: withVocab(picked),
    limits: {
      reviewLimitReached: reviewsLeft <= 0,
      newGrammarLimitReached: newGrammarLeft <= 0,
      newPerSentenceReached: withheld.some((w) => w.reason === 'per-sentence-new-cap'),
    },
    withheld,
  };
}

export function studyDayStart(now: Date, dayCutoffHour: number): Date {
  const start = new Date(now);
  start.setHours(dayCutoffHour, 0, 0, 0);
  if (start > now) start.setDate(start.getDate() - 1);
  return start;
}
