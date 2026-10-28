import type { ItemKind } from '@/lib/library/item-kinds';

// What to study next, as pure logic: the data layer reads candidates and today's counts, this file
// decides. Grammar and vocabulary are equal items, each with its own daily cap for new items.
// Decision: docs/decisions/0001-core-rewrite.md.

export type { ItemKind };

// ts-fsrs State values.
export const CARD_STATE = { NEW: 0, LEARNING: 1, REVIEW: 2, RELEARNING: 3 } as const;

export interface QueueCandidate {
  id: string;
  kind: ItemKind;
  state: number;
  due: Date;
}

export interface DailyCaps {
  newGrammar: number;
  newVocab: number;
  maxReviews: number;
}

// What was already studied in the current study day; `reviews` counts answers on REVIEW cards.
export interface StudiedToday {
  newGrammar: number;
  newVocab: number;
  reviews: number;
}

export interface QueueInput {
  // New candidates must arrive in introduction order (oldest first); order of the rest is free.
  candidates: readonly QueueCandidate[];
  caps: DailyCaps;
  today: StudiedToday;
  now: Date;
  limit?: number;
}

export interface QueuePlan {
  cards: QueueCandidate[];
  // Allowance remaining today before any card of this plan is answered.
  left: { newGrammar: number; newVocab: number; reviews: number };
  // Earliest due date still ahead among started items: the "come back at" hint when cards is empty.
  nextDueAt: Date | null;
}

const isNew = (c: QueueCandidate) => c.state === CARD_STATE.NEW;
const inLearning = (c: QueueCandidate) =>
  c.state === CARD_STATE.LEARNING || c.state === CARD_STATE.RELEARNING;

// A never-studied item is new, never due, whatever its stored due date says.
export function isDue(c: QueueCandidate, now: Date): boolean {
  return !isNew(c) && c.due.getTime() <= now.getTime();
}

const byDue = (a: QueueCandidate, b: QueueCandidate) => a.due.getTime() - b.due.getTime();

// Spreads new grammar and new vocabulary evenly instead of serving one kind in a block.
function interleave(grammar: QueueCandidate[], vocab: QueueCandidate[]): QueueCandidate[] {
  const out: QueueCandidate[] = [];
  let g = 0;
  let v = 0;
  while (g < grammar.length || v < vocab.length) {
    const takeGrammar =
      v >= vocab.length ||
      (g < grammar.length && (g + 1) / (grammar.length + 1) <= (v + 1) / (vocab.length + 1));
    out.push(takeGrammar ? grammar[g++] : vocab[v++]);
  }
  return out;
}

export function planQueue(input: QueueInput): QueuePlan {
  const { candidates, caps, today, now } = input;
  const due = candidates.filter((c) => isDue(c, now));

  // Learning steps are never capped: holding one back would strand a card mid-step.
  const learning = due.filter(inLearning).sort(byDue);
  const reviewsLeft = Math.max(0, caps.maxReviews - today.reviews);
  const reviews = due
    .filter((c) => c.state === CARD_STATE.REVIEW)
    .sort(byDue)
    .slice(0, reviewsLeft);

  const newGrammarLeft = Math.max(0, caps.newGrammar - today.newGrammar);
  const newVocabLeft = Math.max(0, caps.newVocab - today.newVocab);
  const fresh = candidates.filter(isNew);
  const newGrammar = fresh.filter((c) => c.kind === 'GRAMMAR').slice(0, newGrammarLeft);
  const newVocab = fresh.filter((c) => c.kind === 'VOCAB').slice(0, newVocabLeft);

  const ordered = [...learning, ...reviews, ...interleave(newGrammar, newVocab)];
  const cards = input.limit === undefined ? ordered : ordered.slice(0, input.limit);

  const ahead = candidates.filter((c) => !isNew(c) && c.due.getTime() > now.getTime()).sort(byDue);

  return {
    cards,
    left: { newGrammar: newGrammarLeft, newVocab: newVocabLeft, reviews: reviewsLeft },
    nextDueAt: ahead[0]?.due ?? null,
  };
}

export interface ReadyCount {
  // Started cards waiting now: due reviews and learning steps.
  due: number;
  newGrammar: number;
  newVocab: number;
}

// What a plan's cards are, so `status` can say "3 due" apart from the daily allowance.
export function countReady(cards: readonly QueueCandidate[]): ReadyCount {
  const count: ReadyCount = { due: 0, newGrammar: 0, newVocab: 0 };
  for (const c of cards) {
    if (!isNew(c)) count.due++;
    else if (c.kind === 'GRAMMAR') count.newGrammar++;
    else count.newVocab++;
  }
  return count;
}
