import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/settings/schema';
import {
  MAX_WITHHELD_REPORTED,
  pickBatch,
  resolveDirection,
  studyDayStart,
  type ItemLite,
} from '@/lib/srs/select';

let seq = 0;
function item(partial: Partial<ItemLite> = {}): ItemLite {
  seq += 1;
  return {
    id: `item-${seq}`,
    expression: `〜パターン${seq}`,
    reading: null,
    meaningVi: `mẫu ${seq}`,
    level: 'N5',
    notes: null,
    isNew: false,
    ...partial,
  };
}

const freshNone = { fresh: [] };
const noProgress = { reviews: 0, newGrammar: 0, sentences: 0 };

function settings(patch: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...patch };
}

describe('pickBatch', () => {
  it('most overdue due pattern becomes TARGET, batch respects the size pattern count', () => {
    const due = [item(), item(), item(), item()];
    const batch = pickBatch({
      due,
      ...freshNone,
      settings: settings({ sentenceSize: 'medium' }),
      today: noProgress,
    });
    expect(batch.items).toHaveLength(3);
    expect(batch.items[0]).toMatchObject({ id: due[0].id, role: 'TARGET' });
    expect(batch.items.slice(1).every((i) => i.role === 'SECONDARY')).toBe(true);
  });

  it('the smallest size (xshort) weaves a single grammar pattern', () => {
    const batch = pickBatch({
      due: [item(), item(), item()],
      ...freshNone,
      settings: settings({ sentenceSize: 'xshort' }),
      today: noProgress,
    });
    expect(batch.items).toHaveLength(1);
    expect(batch.items[0].role).toBe('TARGET');
  });

  it('introduces new patterns when nothing is due, honoring the daily quota', () => {
    const batch = pickBatch({
      due: [],
      fresh: [item({ isNew: true }), item({ isNew: true }), item({ isNew: true })],
      settings: settings({ sentenceSize: 'medium', dailyNewGrammar: 2, maxNewPerSentence: 2 }),
      today: noProgress,
    });
    expect(batch.items).toHaveLength(2);
    expect(batch.items.every((i) => i.isNew)).toBe(true);
    expect(batch.limits.newGrammarLimitReached).toBe(true);
  });

  it('prefers due reviews over fresh patterns (reviews are sacred)', () => {
    const dueItem = item();
    const batch = pickBatch({
      due: [dueItem],
      fresh: [item({ isNew: true })],
      settings: settings({ sentenceSize: 'xshort' }),
      today: noProgress,
    });
    expect(batch.items[0]).toMatchObject({ id: dueItem.id, role: 'TARGET' });
  });

  it('stops picking due reviews at maxReviewsPerDay', () => {
    const batch = pickBatch({
      due: [item(), item(), item()],
      ...freshNone,
      settings: settings({ maxReviewsPerDay: 10, sentenceSize: 'medium' }),
      today: { ...noProgress, reviews: 9 },
    });
    expect(batch.items).toHaveLength(1);
    expect(batch.limits.reviewLimitReached).toBe(true);
  });

  it('totalOverride gathers more patterns (story/dialogue mode)', () => {
    const due = [item(), item(), item(), item(), item()];
    const batch = pickBatch({
      due,
      ...freshNone,
      settings: settings({ sentenceSize: 'xshort' }),
      today: noProgress,
      totalOverride: 4,
    });
    expect(batch.items).toHaveLength(4);
  });

  it('returns an empty batch when nothing is available', () => {
    const batch = pickBatch({
      due: [],
      ...freshNone,
      settings: settings(),
      today: noProgress,
    });
    expect(batch.items).toHaveLength(0);
  });
});

describe('pickBatch — mastery mode', () => {
  it('normal batches report mode ACQUIRE', () => {
    const batch = pickBatch({
      due: [item()],
      ...freshNone,
      settings: settings(),
      today: noProgress,
    });
    expect(batch.mode).toBe('ACQUIRE');
  });

  it('empty acquisition queue + a graduated pool recombines those patterns (MASTERY)', () => {
    const pool = [item(), item(), item(), item()];
    const batch = pickBatch({
      due: [],
      ...freshNone,
      mastery: pool,
      settings: settings({ sentenceSize: 'medium' }), // budget 3
      today: noProgress,
    });
    expect(batch.mode).toBe('MASTERY');
    expect(batch.items).toHaveLength(3); // capped at the sentence pattern budget
    expect(batch.items[0]).toMatchObject({ id: pool[0].id, role: 'TARGET' });
    expect(batch.items.slice(1).every((i) => i.role === 'SECONDARY')).toBe(true);
    expect(batch.items.map((i) => i.id)).toEqual(pool.slice(0, 3).map((i) => i.id));
  });

  it('mastery is ignored while due reviews remain (acquisition wins)', () => {
    const dueItem = item();
    const batch = pickBatch({
      due: [dueItem],
      ...freshNone,
      mastery: [item(), item()],
      settings: settings({ sentenceSize: 'xshort' }),
      today: noProgress,
    });
    expect(batch.mode).toBe('ACQUIRE');
    expect(batch.items[0]).toMatchObject({ id: dueItem.id });
  });

  it('mastery ignores the daily review cap (bonus practice past a cleared queue)', () => {
    const batch = pickBatch({
      due: [],
      ...freshNone,
      mastery: [item(), item()],
      settings: settings({ sentenceSize: 'short', maxReviewsPerDay: 10 }),
      today: { ...noProgress, reviews: 10 }, // cap already hit
    });
    expect(batch.mode).toBe('MASTERY');
    expect(batch.items.length).toBeGreaterThan(0);
  });

  it('daily new-grammar cap spent (fresh still in store) enters MASTERY, not an empty day', () => {
    const batch = pickBatch({
      due: [],
      fresh: [item({ isNew: true }), item({ isNew: true })], // patterns remain in the store...
      mastery: [item(), item(), item()],
      settings: settings({ sentenceSize: 'short', dailyNewGrammar: 20 }),
      today: { ...noProgress, newGrammar: 20 }, // ...but today's cap is exhausted
    });
    expect(batch.mode).toBe('MASTERY');
    expect(batch.items.length).toBeGreaterThan(0);
  });

  it('fresh still servable (cap not hit) stays ACQUIRE even with a graduated pool', () => {
    const batch = pickBatch({
      due: [],
      fresh: [item({ isNew: true })],
      mastery: [item(), item()],
      settings: settings({ sentenceSize: 'short', dailyNewGrammar: 20 }),
      today: { ...noProgress, newGrammar: 5 }, // cap NOT hit — keep introducing new first
    });
    expect(batch.mode).toBe('ACQUIRE');
  });

  it('an empty graduated pool falls through to a normal (empty) ACQUIRE batch', () => {
    const batch = pickBatch({
      due: [],
      ...freshNone,
      mastery: [],
      settings: settings(),
      today: noProgress,
    });
    expect(batch.mode).toBe('ACQUIRE');
    expect(batch.items).toHaveLength(0);
  });
});

describe('pickBatch — vocab weaving (separate budget)', () => {
  it('weaves due vocab in AFTER grammar without reducing the grammar count', () => {
    const grammar = [item(), item(), item()];
    const vocab = [item({ expression: '語彙1' }), item({ expression: '語彙2' })];
    const batch = pickBatch({
      due: grammar,
      ...freshNone,
      vocab,
      settings: settings({ sentenceSize: 'medium', vocabPerSentence: 2 }), // grammar budget 3
      today: noProgress,
    });
    const grammarPicks = batch.items.filter((i) => i.role !== 'VOCAB');
    const vocabPicks = batch.items.filter((i) => i.role === 'VOCAB');
    expect(grammarPicks).toHaveLength(3); // grammar count intact
    expect(vocabPicks).toHaveLength(2); // vocab added on top
    expect(batch.items).toHaveLength(5);
  });

  it('caps vocab at settings.vocabPerSentence', () => {
    const batch = pickBatch({
      due: [item()],
      ...freshNone,
      vocab: [item(), item(), item()],
      settings: settings({ sentenceSize: 'xshort', vocabPerSentence: 1 }),
      today: noProgress,
    });
    expect(batch.items.filter((i) => i.role === 'VOCAB')).toHaveLength(1);
  });

  it('vocabPerSentence=0 weaves no vocab', () => {
    const batch = pickBatch({
      due: [item()],
      ...freshNone,
      vocab: [item(), item()],
      settings: settings({ sentenceSize: 'xshort', vocabPerSentence: 0 }),
      today: noProgress,
    });
    expect(batch.items.every((i) => i.role !== 'VOCAB')).toBe(true);
  });

  it('vocab rides along in MASTERY mode too', () => {
    const batch = pickBatch({
      due: [],
      ...freshNone,
      mastery: [item(), item()],
      vocab: [item()],
      settings: settings({ sentenceSize: 'medium', vocabPerSentence: 2 }),
      today: noProgress,
    });
    expect(batch.mode).toBe('MASTERY');
    expect(batch.items.filter((i) => i.role === 'VOCAB')).toHaveLength(1);
  });
});

describe('pickBatch — focused practice', () => {
  it('focus items jump the queue, including learned-but-not-due (early review)', () => {
    const g1 = item();
    const g2 = item();
    const ahead = item();
    const batch = pickBatch({
      due: [g1, g2],
      ...freshNone,
      settings: settings({ sentenceSize: 'short' }),
      today: noProgress,
      focus: { ids: new Set([ahead.id]), ahead: [ahead] },
    });
    expect(batch.items[0]).toMatchObject({ id: ahead.id, role: 'TARGET', focusHit: true });
    expect(batch.items[1]).toMatchObject({ id: g1.id, focusHit: false });
  });

  it('a small focus is topped up with general patterns to the sentence budget', () => {
    const focusItem = item();
    const others = [item(), item(), item()];
    const batch = pickBatch({
      due: [focusItem, ...others],
      ...freshNone,
      settings: settings({ sentenceSize: 'medium' }),
      today: noProgress,
      focus: { ids: new Set([focusItem.id]), ahead: [] },
    });
    expect(batch.items).toHaveLength(3);
    expect(batch.items[0]).toMatchObject({ id: focusItem.id, focusHit: true });
    expect(batch.items.slice(1).every((i) => i.focusHit === false)).toBe(true);
  });

  it('whole-level focus keeps scheduled slots pure (no other-level fillers)', () => {
    const n3a = item({ level: 'N3' });
    const n3b = item({ level: 'N3' });
    const n5Reviews = [item(), item(), item()]; // due N5 reviews that must NOT fill the sentence
    const batch = pickBatch({
      due: [n3a, n3b, ...n5Reviews],
      ...freshNone,
      settings: settings({ sentenceSize: 'xlong' }),
      today: noProgress,
      focus: { ids: new Set([n3a.id, n3b.id]), ahead: [], fillFromFocusOnly: true },
    });
    expect(batch.items).toHaveLength(2);
    expect(batch.items.every((i) => i.focusHit === true)).toBe(true);
    expect(batch.items.map((i) => i.id)).toEqual([n3a.id, n3b.id]);
  });

  it('an explicitly focused NEW pattern is served even with the daily quota spent', () => {
    const f1 = item({ isNew: true });
    const batch = pickBatch({
      due: [],
      fresh: [f1],
      settings: settings({ sentenceSize: 'short', dailyNewGrammar: 3 }),
      today: { ...noProgress, newGrammar: 3 }, // cap already spent
      focus: { ids: new Set([f1.id]), ahead: [] },
    });
    expect(batch.items).toHaveLength(1);
    expect(batch.items[0]).toMatchObject({ id: f1.id, role: 'TARGET', focusHit: true });
  });

  it('a NON-focused new pattern is still withheld by the daily quota, and says so', () => {
    const general = item({ isNew: true });
    const batch = pickBatch({
      due: [],
      fresh: [general],
      settings: settings({ sentenceSize: 'short', dailyNewGrammar: 3 }),
      today: { ...noProgress, newGrammar: 3 },
    });
    expect(batch.items).toHaveLength(0);
    expect(batch.withheld).toEqual([
      { expression: general.expression, reason: 'daily-new-cap', focusHit: false },
    ]);
  });

  it('two focused NEW patterns are served one per sentence, the rest reported as held back', () => {
    const f1 = item({ isNew: true });
    const f2 = item({ isNew: true });
    const batch = pickBatch({
      due: [],
      fresh: [f1, f2],
      settings: settings({ sentenceSize: 'short', dailyNewGrammar: 0, maxNewPerSentence: 1 }),
      today: noProgress,
      focus: { ids: new Set([f1.id, f2.id]), ahead: [] },
    });
    expect(batch.items.map((i) => i.id)).toEqual([f1.id]);
    expect(batch.withheld).toEqual([
      { expression: f2.expression, reason: 'per-sentence-new-cap', focusHit: true },
    ]);
    expect(batch.limits.newPerSentenceReached).toBe(true);
  });
});

describe('pickBatch — per-sentence novelty cap (maxNewPerSentence)', () => {
  it('an empty review queue no longer packs the whole sentence with never-seen patterns', () => {
    const fresh = [item({ isNew: true }), item({ isNew: true }), item({ isNew: true })];
    const batch = pickBatch({
      due: [],
      fresh,
      settings: settings({ sentenceSize: 'medium', dailyNewGrammar: 3 }), // maxNewPerSentence default 1
      today: noProgress,
    });
    expect(batch.items.filter((i) => i.isNew)).toHaveLength(1);
    expect(batch.limits.newPerSentenceReached).toBe(true);
    expect(batch.withheld.every((w) => w.reason === 'per-sentence-new-cap')).toBe(true);
  });

  it('the two caps are independent: the per-sentence cap does not consume the day budget', () => {
    const settingsUsed = settings({
      sentenceSize: 'medium',
      dailyNewGrammar: 3,
      maxNewPerSentence: 1,
    });
    for (const newGrammar of [0, 1, 2]) {
      const batch = pickBatch({
        due: [],
        fresh: [item({ isNew: true }), item({ isNew: true })],
        settings: settingsUsed,
        today: { ...noProgress, newGrammar },
      });
      expect(batch.items.filter((i) => i.isNew)).toHaveLength(1);
    }
  });

  it('a raised cap lets more novelty through (the knob is real, not decorative)', () => {
    const batch = pickBatch({
      due: [],
      fresh: [item({ isNew: true }), item({ isNew: true }), item({ isNew: true })],
      settings: settings({ sentenceSize: 'medium', dailyNewGrammar: 5, maxNewPerSentence: 3 }),
      today: noProgress,
    });
    expect(batch.items.filter((i) => i.isNew)).toHaveLength(3);
    expect(batch.limits.newPerSentenceReached).toBe(false);
    expect(batch.withheld).toEqual([]);
  });

  it('due REVIEWS are never touched by the novelty cap (reviews are sacred)', () => {
    const batch = pickBatch({
      due: [item(), item(), item()],
      fresh: [item({ isNew: true })],
      settings: settings({ sentenceSize: 'medium', maxNewPerSentence: 1 }),
      today: noProgress,
    });
    expect(batch.items).toHaveLength(3);
    expect(batch.items.every((i) => !i.isNew)).toBe(true);
  });

  it('the review cap is reported as a withheld reason too', () => {
    const blocked = [item(), item()];
    const batch = pickBatch({
      due: blocked,
      ...freshNone,
      settings: settings({ maxReviewsPerDay: 10, sentenceSize: 'medium' }),
      today: { ...noProgress, reviews: 10 },
    });
    expect(batch.items).toHaveLength(0);
    expect(batch.withheld.map((w) => w.reason)).toEqual(['review-cap', 'review-cap']);
  });

  it('withheld reporting is capped so the sheet cannot grow unbounded', () => {
    const fresh = Array.from({ length: 12 }, () => item({ isNew: true }));
    const batch = pickBatch({
      due: [],
      fresh,
      settings: settings({ sentenceSize: 'paragraph', dailyNewGrammar: 20 }),
      today: noProgress,
    });
    expect(batch.withheld).toHaveLength(MAX_WITHHELD_REPORTED);
  });
});

describe('resolveDirection', () => {
  it('fixed directions pass through', () => {
    expect(resolveDirection('JA_VI', 5)).toBe('JA_VI');
    expect(resolveDirection('VI_JA', 5)).toBe('VI_JA');
  });

  it('ALTERNATING flips by sentence count, starting JA→VI', () => {
    expect(resolveDirection('ALTERNATING', 0)).toBe('JA_VI');
    expect(resolveDirection('ALTERNATING', 1)).toBe('VI_JA');
    expect(resolveDirection('ALTERNATING', 2)).toBe('JA_VI');
  });
});

describe('studyDayStart', () => {
  it('before the cutoff hour belongs to the previous day', () => {
    const now = new Date('2026-07-06T02:30:00'); // local 02:30, cutoff 04:00
    const start = studyDayStart(now, 4);
    expect(start.getDate()).toBe(5);
    expect(start.getHours()).toBe(4);
  });

  it('after the cutoff hour belongs to today', () => {
    const now = new Date('2026-07-06T10:00:00');
    const start = studyDayStart(now, 4);
    expect(start.getDate()).toBe(6);
    expect(start.getHours()).toBe(4);
  });
});
