import { describe, expect, it } from 'vitest';
import { summarizeSession, type SessionAnswer } from '@/lib/domain/session-summary';

const a = (itemId: string, rating: SessionAnswer['rating'], intro = false): SessionAnswer => ({
  itemId,
  rating,
  intro,
});

describe('summarizeSession', () => {
  it('counts every card as reviewed but only the tested ones towards the rate', () => {
    const s = summarizeSession([a('n1', 3, true), a('v1', 3), a('v2', 4), a('v3', 1), a('v4', 2)]);
    expect(s).toMatchObject({ reviewed: 5, tested: 4, remembered: 2, rate: 50, met: 1 });
  });

  it('has no rate when the session only met new items', () => {
    expect(summarizeSession([a('n1', 3, true)]).rate).toBeNull();
  });

  it('rounds the rate to a whole percent', () => {
    expect(summarizeSession([a('v1', 3), a('v2', 3), a('v3', 1)]).rate).toBe(67);
  });

  it('lists at most three cards to look at again, the forgotten before the hard', () => {
    const s = summarizeSession([
      a('h1', 2),
      a('f1', 1),
      a('ok', 3),
      a('h2', 2),
      a('f2', 1),
      a('f3', 1),
    ]);
    expect(s.toReview.map((r) => r.itemId)).toEqual(['f1', 'f2', 'f3']);
    expect(summarizeSession([a('h1', 2), a('f1', 1)]).toReview.map((r) => r.itemId)).toEqual([
      'f1',
      'h1',
    ]);
  });

  it('lists an item once, and never an intro or a remembered card', () => {
    const s = summarizeSession([a('v1', 1), a('v1', 1), a('n1', 1, true), a('v2', 4)]);
    expect(s.toReview.map((r) => r.itemId)).toEqual(['v1']);
  });
});
