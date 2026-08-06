import { SENTENCE_SIZE_SPEC } from '@/lib/select';
import { stripDecoration } from '@/lib/normalize';
import { REGISTERS, type SentenceSize } from '@/lib/settings-schema';

/** Local alias — `settings-schema` exports the tuple but no named type for it. */
type Register = (typeof REGISTERS)[number];

// MECHANICAL scoring of ONE generated exercise, for eval/generation-quality-eval.md.
//
// WHY IT IS A PURE FUNCTION AND NOT A MODEL JUDGE. Plan 2026-07-26-natural-generation step 1.1 asks
// for a rubric that "applied twice to the same output gives the same score". The day this was written
// (2026-07-28) the project had just spent a session discovering that its other eval's findings were
// mostly artefacts of its own harness — a summary standing in for real bytes, a leading prompt, a
// fixture with no room to move. Four of the five metrics below can be computed from the staged row
// alone, so they are, and nothing about them can drift with a model's mood. The one genuinely
// judgement-shaped property (does the sentence sound like something a person would say) is
// deliberately NOT in here; the rubric handles it separately and says out loud that it is the soft one.
//
// Everything here is deterministic: same input, same numbers, no clock, no randomness, no I/O.

/** How many characters of the pattern to drop before the loose match. See `usedLoose`. */
const INFLECTION_TAIL = 3;
/**
 * Floor on the stem length. It is 2, not 3, and that was a bug worth keeping the note for: at 3, a
 * THREE-character pattern could not be trimmed at all, so `loosePrefix` returned the whole pattern and
 * the loose match silently degraded into the exact one. Measured 2026-07-28: 〜に限る and 〜かねる were
 * both scored "not used" against sentences reading 「に限ります」 and 「判断しかねますが」 — 4 of 4 reported
 * misses in the first real run were this bug, not the tutor. A floor that disables the very mechanism
 * it guards is worse than no floor.
 */
const MIN_LOOSE_PREFIX = 2;

/** Polite-form markers. Presence is decisive; absence only means "no polite marker was found". */
const POLITE = /で(す|し[たょ])|ま(す|した|せん|しょう)/u;

export interface GenerationScoreInput {
  /** The staged row's direction — decides WHICH field holds the Japanese (invariant 9's cousin). */
  direction: 'JA_VI' | 'VI_JA';
  /** The exercise shown to the learner (source language, per `direction`). */
  sourceText: string;
  /** Claude's reference translation, frozen at stage time. Japanese when direction is VI_JA. */
  suggested: string | null;
  /** The size setting in force when this was generated — sets the character target. */
  sentenceSize: SentenceSize;
  /** The register setting in force. */
  requestedRegister: Register;
  /** Expressions of the patterns the batch asked for, as the sheet listed them. */
  requestedPatterns: readonly string[];
  /**
   * expression -> slot id, for the collision count. Optional because `slot` does not exist in the
   * enrichment contract yet (plan Phase 2.1) — until it does, a baseline run supplies a hand-authored
   * labelling of the eval library, which is why this is an argument rather than a lookup.
   */
  slots?: Readonly<Record<string, string>>;
  /** Slot ids that may hold at most ONE pattern per sentence. */
  exclusiveSlots?: readonly string[];
}

export interface GenerationScore {
  /** The Japanese text that was actually scored — sourceText or suggested, per direction. */
  japanese: string;
  patternsRequested: number;
  /** Patterns whose decoration-stripped form appears VERBATIM. Under-counts: conjugation hides some. */
  usedExact: number;
  /** Patterns whose stem prefix appears. Over-counts slightly. The true value sits in [exact, loose]. */
  usedLoose: number;
  /** Source-text length against the size spec's target for the source language. */
  charTarget: number;
  charActual: number;
  /** (actual - target) / target. Positive = long. The spec's own tolerance is ±30%. */
  charDeviation: number;
  /** 'polite' when a polite marker is present, else 'plain'. Never "mixed" — see the note below. */
  registerObserved: 'polite' | 'plain';
  /** Did the observed register match what was asked for? `mixed` always counts as a match. */
  registerMatches: boolean;
  /** Pairs of requested patterns sharing an EXCLUSIVE slot. Null when no labelling was supplied. */
  slotCollisions: number | null;
}

/** The Japanese half of a staged row. Branching on `direction` is the contract, not a convenience. */
export function japaneseOf(input: {
  direction: 'JA_VI' | 'VI_JA';
  sourceText: string;
  suggested: string | null;
}): string {
  return input.direction === 'JA_VI' ? input.sourceText : (input.suggested ?? '');
}

/**
 * The loose form of a pattern: its stem with the inflecting tail dropped.
 *
 * This is a HEURISTIC and is labelled as one. 「〜わけにはいかない」 is what the library stores, but a
 * polite sentence contains 「わけにはいきません」, so a verbatim search reports "the tutor ignored the
 * pattern it was told to use" — a false failure, and exactly the class of harness artefact this file
 * exists to avoid. Dropping a fixed tail is deliberately dumb: the project ships NO morphological
 * analyser on purpose, so the alternative is not a better matcher, it is a new
 * architectural dependency. The bias is stated in the metric name instead of hidden in the number.
 */
export function loosePrefix(expression: string): string {
  const bare = stripDecoration(expression);
  const cut = bare.length - INFLECTION_TAIL;
  return bare.slice(0, Math.max(MIN_LOOSE_PREFIX, cut));
}

export function scoreGeneration(input: GenerationScoreInput): GenerationScore {
  const japanese = japaneseOf(input);
  const spec = SENTENCE_SIZE_SPEC[input.sentenceSize];
  // The budget is on what the LEARNER READS, which is the source text — Japanese under JA_VI,
  // Vietnamese under VI_JA. Scoring the wrong field would make every VI_JA row look 55% over budget.
  const charTarget = input.direction === 'JA_VI' ? spec.ja : spec.vi;
  const charActual = [...input.sourceText].length;

  let usedExact = 0;
  let usedLoose = 0;
  for (const expression of input.requestedPatterns) {
    const bare = stripDecoration(expression);
    if (bare.length > 0 && japanese.includes(bare)) usedExact += 1;
    if (japanese.includes(loosePrefix(expression))) usedLoose += 1;
  }

  // Only the PRESENCE of a polite marker is evidence. A sentence with none is reported as plain, which
  // is right for `casual`/`plain` targets and is a legitimate miss for `polite` — but note that this
  // cannot see a MIXED-register sentence (polite ending, plain subordinate clause). That is the one
  // register defect the mechanical check misses, and the rubric hands it to the soft pass instead of
  // pretending a regex found it.
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
    // A slot holding n occupants contributes n-1 collisions: three summarising connectives in one
    // sentence is a worse batch than two, and a per-slot boolean would score them the same.
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
