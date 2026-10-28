import { describe, expect, it } from 'vitest';
import {
  CARD_STATE,
  countReady,
  isDue,
  planQueue,
  type DailyCaps,
  type QueueCandidate,
  type StudiedToday,
} from '@/lib/domain/queue';

const NOW = new Date('2030-01-15T03:00:00.000Z');
const MINUTE = 60_000;
const at = (minutes: number) => new Date(NOW.getTime() + minutes * MINUTE);

const CAPS: DailyCaps = { newGrammar: 5, newVocab: 15, maxReviews: 200 };
const NONE: StudiedToday = { newGrammar: 0, newVocab: 0, reviews: 0 };

let seq = 0;
function card(kind: QueueCandidate['kind'], state: number, dueInMinutes = 0): QueueCandidate {
  seq++;
  return { id: `${kind[0]}${seq}`, kind, state, due: at(dueInMinutes) };
}
const newGrammar = (n: number) => Array.from({ length: n }, () => card('GRAMMAR', CARD_STATE.NEW));
const newVocab = (n: number) => Array.from({ length: n }, () => card('VOCAB', CARD_STATE.NEW));

describe('isDue', () => {
  it('a never-studied item is never due, even with a past due date', () => {
    expect(isDue(card('VOCAB', CARD_STATE.NEW, -60), NOW)).toBe(false);
  });

  it('a started item is due once its date has passed', () => {
    expect(isDue(card('GRAMMAR', CARD_STATE.REVIEW, 0), NOW)).toBe(true);
    expect(isDue(card('GRAMMAR', CARD_STATE.REVIEW, 1), NOW)).toBe(false);
  });
});

describe('planQueue', () => {
  it('caps new grammar and new vocabulary separately', () => {
    const plan = planQueue({
      candidates: [...newGrammar(8), ...newVocab(30)],
      caps: CAPS,
      today: NONE,
      now: NOW,
    });
    expect(plan.cards.filter((c) => c.kind === 'GRAMMAR')).toHaveLength(5);
    expect(plan.cards.filter((c) => c.kind === 'VOCAB')).toHaveLength(15);
  });

  it('counts what was already introduced today against each cap', () => {
    const plan = planQueue({
      candidates: [...newGrammar(8), ...newVocab(30)],
      caps: CAPS,
      today: { newGrammar: 5, newVocab: 10, reviews: 0 },
      now: NOW,
    });
    expect(plan.cards.filter((c) => c.kind === 'GRAMMAR')).toHaveLength(0);
    expect(plan.cards.filter((c) => c.kind === 'VOCAB')).toHaveLength(5);
    expect(plan.left).toEqual({ newGrammar: 0, newVocab: 5, reviews: 200 });
  });

  it('serves learning steps first, then reviews by due date, then new items', () => {
    const review = card('VOCAB', CARD_STATE.REVIEW, -30);
    const olderReview = card('GRAMMAR', CARD_STATE.REVIEW, -90);
    const relearning = card('GRAMMAR', CARD_STATE.RELEARNING, -1);
    const [fresh] = newVocab(1);
    const plan = planQueue({
      candidates: [fresh, review, olderReview, relearning],
      caps: CAPS,
      today: NONE,
      now: NOW,
    });
    expect(plan.cards.map((c) => c.id)).toEqual([
      relearning.id,
      olderReview.id,
      review.id,
      fresh.id,
    ]);
  });

  it('caps reviews per day but never holds back a learning step', () => {
    const reviews = Array.from({ length: 5 }, () => card('VOCAB', CARD_STATE.REVIEW, -10));
    const learning = card('GRAMMAR', CARD_STATE.LEARNING, -1);
    const plan = planQueue({
      candidates: [...reviews, learning],
      caps: { ...CAPS, maxReviews: 3 },
      today: { ...NONE, reviews: 1 },
      now: NOW,
    });
    expect(plan.cards[0].id).toBe(learning.id);
    expect(plan.cards.filter((c) => c.state === CARD_STATE.REVIEW)).toHaveLength(2);
  });

  it('spreads new grammar and vocabulary instead of serving one kind in a block', () => {
    const plan = planQueue({
      candidates: [...newGrammar(2), ...newVocab(4)],
      caps: CAPS,
      today: NONE,
      now: NOW,
    });
    expect(plan.cards.map((c) => c.kind)).toEqual([
      'VOCAB',
      'GRAMMAR',
      'VOCAB',
      'VOCAB',
      'GRAMMAR',
      'VOCAB',
    ]);
  });

  it('keeps new items in introduction order within a kind', () => {
    const grammar = newGrammar(3);
    const plan = planQueue({ candidates: grammar, caps: CAPS, today: NONE, now: NOW });
    expect(plan.cards.map((c) => c.id)).toEqual(grammar.map((c) => c.id));
  });

  it('truncates to the limit after ordering', () => {
    const review = card('GRAMMAR', CARD_STATE.REVIEW, -5);
    const plan = planQueue({
      candidates: [...newVocab(3), review],
      caps: CAPS,
      today: NONE,
      now: NOW,
      limit: 1,
    });
    expect(plan.cards.map((c) => c.id)).toEqual([review.id]);
  });

  it('reports when the next started item comes due, ignoring new ones', () => {
    const soon = card('VOCAB', CARD_STATE.LEARNING, 10);
    const later = card('GRAMMAR', CARD_STATE.REVIEW, 600);
    const plan = planQueue({
      candidates: [later, soon, ...newGrammar(1)],
      caps: { ...CAPS, newGrammar: 0 },
      today: NONE,
      now: NOW,
    });
    expect(plan.cards).toEqual([]);
    expect(plan.nextDueAt).toEqual(soon.due);
  });

  it('an empty library gives an empty plan with nothing ahead', () => {
    expect(planQueue({ candidates: [], caps: CAPS, today: NONE, now: NOW })).toEqual({
      cards: [],
      left: { newGrammar: 5, newVocab: 15, reviews: 200 },
      nextDueAt: null,
    });
  });
});

describe('countReady', () => {
  it('splits waiting cards into started ones and new ones by kind', () => {
    const plan = planQueue({
      candidates: [
        card('GRAMMAR', CARD_STATE.REVIEW, -5),
        card('VOCAB', CARD_STATE.LEARNING, -1),
        card('VOCAB', CARD_STATE.REVIEW, 60),
        ...newGrammar(2),
        ...newVocab(1),
      ],
      caps: CAPS,
      today: NONE,
      now: NOW,
    });
    expect(countReady(plan.cards)).toEqual({ due: 2, newGrammar: 2, newVocab: 1 });
  });

  it('counts nothing for an empty store, whatever the allowance', () => {
    expect(countReady([])).toEqual({ due: 0, newGrammar: 0, newVocab: 0 });
  });
});
