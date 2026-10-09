import { SENTENCE_SIZE_SPEC } from '@/lib/srs/select';
import { stripDecoration } from '@/lib/core/normalize';
import { REGISTERS, type SentenceSize } from '@/lib/settings/schema';

type Register = (typeof REGISTERS)[number];

const INFLECTION_TAIL = 3;
const MIN_LOOSE_PREFIX = 2;

const POLITE = /で(す|し[たょ])|ま(す|した|せん|しょう)/u;

export interface GenerationScoreInput {
  direction: 'JA_VI' | 'VI_JA';
  sourceText: string;
  suggested: string | null;
  sentenceSize: SentenceSize;
  requestedRegister: Register;
  requestedPatterns: readonly string[];
  slots?: Readonly<Record<string, string>>;
  exclusiveSlots?: readonly string[];
}

export interface GenerationScore {
  japanese: string;
  patternsRequested: number;
  usedExact: number;
  usedLoose: number;
  charTarget: number;
  charActual: number;
  charDeviation: number;
  registerObserved: 'polite' | 'plain';
  registerMatches: boolean;
  slotCollisions: number | null;
}

export function japaneseOf(input: {
  direction: 'JA_VI' | 'VI_JA';
  sourceText: string;
  suggested: string | null;
}): string {
  return input.direction === 'JA_VI' ? input.sourceText : (input.suggested ?? '');
}

export function loosePrefix(expression: string): string {
  const bare = stripDecoration(expression);
  const cut = bare.length - INFLECTION_TAIL;
  return bare.slice(0, Math.max(MIN_LOOSE_PREFIX, cut));
}

export function scoreGeneration(input: GenerationScoreInput): GenerationScore {
  const japanese = japaneseOf(input);
  const spec = SENTENCE_SIZE_SPEC[input.sentenceSize];
  const charTarget = input.direction === 'JA_VI' ? spec.ja : spec.vi;
  const charActual = [...input.sourceText].length;

  let usedExact = 0;
  let usedLoose = 0;
  for (const expression of input.requestedPatterns) {
    const bare = stripDecoration(expression);
    if (bare.length > 0 && japanese.includes(bare)) usedExact += 1;
    if (japanese.includes(loosePrefix(expression))) usedLoose += 1;
  }

  const registerObserved: 'polite' | 'plain' = POLITE.test(japanese) ? 'polite' : 'plain';
  const wantsPolite =
    input.requestedRegister === 'polite' ||
    input.requestedRegister === 'keigo' ||
    input.requestedRegister === 'business';
  const registerMatches =
    input.requestedRegister === 'mixed' || (registerObserved === 'polite') === wantsPolite;

  let slotCollisions: number | null = null;
  if (input.slots) {
    const exclusive = new Set(input.exclusiveSlots ?? []);
    const seen = new Map<string, number>();
    for (const expression of input.requestedPatterns) {
      const slot = input.slots[expression];
      if (!slot || !exclusive.has(slot)) continue;
      seen.set(slot, (seen.get(slot) ?? 0) + 1);
    }
    slotCollisions = [...seen.values()].reduce((n, count) => n + Math.max(0, count - 1), 0);
  }

  return {
    japanese,
    patternsRequested: input.requestedPatterns.length,
    usedExact,
    usedLoose,
    charTarget,
    charActual,
    charDeviation: (charActual - charTarget) / charTarget,
    registerObserved,
    registerMatches,
    slotCollisions,
  };
}
