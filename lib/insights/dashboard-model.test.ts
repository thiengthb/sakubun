import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_DAYS,
  STUDY_DAYS,
  buildDashboard,
  type DashboardInput,
  type ItemRow,
  type LogRow,
} from '@/lib/insights/dashboard-model';

const NOW = new Date('2030-01-15T03:00:00.000Z');
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const ahead = (days: number) => new Date(NOW.getTime() + days * DAY);

let n = 0;
function item(
  over: Partial<ItemRow> & { state?: number; due?: Date; lapses?: number; difficulty?: number },
): ItemRow {
  n += 1;
  const { state, due, lapses, difficulty, ...rest } = over;
  return {
    id: `i${n}`,
    kind: 'GRAMMAR',
    level: 'N5',
    suspended: false,
    expression: `e${n}`,
    meaningVi: 'nghĩa',
    enrichment: null,
    srs:
      state === undefined
        ? null
        : {
            state,
            due: due ?? ahead(3),
            reps: state === 0 ? 0 : 2,
            lapses: lapses ?? 0,
            difficulty: difficulty ?? 5,
          },
    ...rest,
  };
}

function log(over: Partial<LogRow>): LogRow {
  return {
    reviewedAt: ago(1),
    rating: 3,
    state: 2,
    errorTags: null,
    itemId: 'i1',
    expression: 'e1',
    ...over,
  };
}

function input(over: Partial<DashboardInput>): DashboardInput {
  return {
    now: NOW,
    settings: { dayCutoffHour: 4, desiredRetention: 0.9, sessionGoal: 20, dailyNewGrammar: 3 },
    logs: [],
    sentences: [],
    items: [],
    streak: { current: 0, longest: 0 },
    ...over,
  };
}

describe('the Phân tích page counts every number from one set of rows', () => {
  const items = [
    item({}), // no SRS row yet: still new
    item({ state: 0 }),
    item({ state: 1, due: ago(1) }), // learning, due now
    item({ state: 2, due: ahead(2) }), // review, due in the forecast
    item({ state: 2, due: ahead(20), level: 'N4' }), // review, beyond the forecast
    item({ state: 3, due: ago(0.1), suspended: true }), // suspended: never due, never counted live
    item({ kind: 'VOCAB', state: 2, due: ago(1), lapses: 9 }), // vocab: not in grammar counts
  ];
  const d = buildDashboard(input({ items }));

  it('the state split adds up to the grammar library, suspended included', () => {
    const m = d.mastery;
    expect(m).toEqual({ new: 2, learning: 1, review: 2, relearning: 0, suspended: 1 });
    expect(m.new + m.learning + m.review + m.relearning + m.suspended).toBe(d.grammarTotal);
    expect(d.levelDist.reduce((a, l) => a + l.total, 0)).toBe(d.grammarTotal);
  });

  it('new, due and mastered agree with the split', () => {
    expect(d.newItems).toBe(d.mastery.new);
    expect(d.masteredGrammar).toBe(d.mastery.review);
    expect(d.dueNow).toBe(1); // the learning card; not the suspended one, not the vocab one
    expect(d.vocabTotal).toBe(1);
  });

  it('the 14-day forecast holds only started, live grammar due after now', () => {
    expect(d.forecast14).toHaveLength(14);
    expect(d.forecast14.reduce((a, f) => a + f.count, 0)).toBe(1);
  });

  it('leeches count every kind; the hard-pattern watchlist is grammar only', () => {
    expect(d.weak.leeches.map((l) => l.expression)).toEqual([items[6].expression]);
    const hard = buildDashboard(
      input({
        items: [
          item({ state: 2, difficulty: 8 }),
          item({ kind: 'VOCAB', state: 2, difficulty: 9 }),
        ],
      }),
    );
    expect(hard.weak.watchlist).toHaveLength(1);
  });
});

describe('windows', () => {
  it('heatmap, 30-day counts and the daily table count the same reviews', () => {
    const logs = [
      log({ reviewedAt: ago(1) }),
      log({ reviewedAt: ago(1), state: 0 }),
      log({ reviewedAt: ago(40), rating: 1 }),
      log({ reviewedAt: ago(364.5) }), // in the daily table, before the heatmap window
    ];
    const d = buildDashboard(input({ logs }));
    expect(d.activity).toHaveLength(ACTIVITY_DAYS);
    expect(d.study.daily).toHaveLength(STUDY_DAYS);
    expect(d.reviewsLast30).toBe(2);
    expect(d.newLast30).toBe(1);
    const heat = d.activity.reduce((a, x) => a + x.count, 0);
    expect(heat).toBe(3);
    expect(d.study.daily.reduce((a, x) => a + x.reviews, 0)).toBe(4);
    for (const day of d.activity) {
      const row = d.study.daily.find((x) => x.day === day.day);
      expect(row?.reviews ?? 0, day.day).toBe(day.count);
    }
  });

  it('weak spots look back 30 days and skip deleted items', () => {
    const logs = [
      log({ rating: 1, errorTags: '["particle"]', reviewedAt: ago(2) }),
      log({ rating: 2, errorTags: '["particle"]', reviewedAt: ago(3) }),
      log({ rating: 1, errorTags: '["register"]', reviewedAt: ago(45) }),
      log({ rating: 1, errorTags: '["register"]', itemId: null, expression: null }),
      log({ rating: 3, errorTags: '["register"]' }),
    ];
    const d = buildDashboard(input({ logs }));
    expect(d.weak.tagCounts).toEqual([{ tag: 'particle', count: 2 }]);
    expect(d.weak.worstItems).toEqual([
      { itemId: 'i1', expression: 'e1', misses: 2, tags: ['particle'] },
    ]);
  });
});
