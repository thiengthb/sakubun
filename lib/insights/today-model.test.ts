import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SEC_PER_CARD,
  estimateMinutes,
  forecast,
  mostMissed,
  secondsPerCard,
  studyWeek,
  todayHero,
} from '@/lib/insights/today-model';

const at = (ms: number) => new Date(Date.UTC(2026, 10, 14, 1) + ms);
// `n` reviews `stepSec` apart, starting `startMs` after the base time.
const run = (n: number, stepSec: number, startMs = 0) =>
  Array.from({ length: n }, (_, i) => at(startMs + i * stepSec * 1000));

describe('secondsPerCard: the median gap between reviews of one sitting', () => {
  it('falls back to a flat pace with no reviews, or fewer than 20 usable gaps', () => {
    expect(secondsPerCard([])).toBe(DEFAULT_SEC_PER_CARD);
    expect(secondsPerCard(run(20, 10))).toBe(DEFAULT_SEC_PER_CARD); // 19 gaps
  });

  it('falls back too when every gap is a new sitting (2 minutes or more)', () => {
    expect(secondsPerCard(run(30, 180))).toBe(DEFAULT_SEC_PER_CARD);
  });

  it('takes the median of the short gaps and ignores the breaks between sittings', () => {
    const morning = run(11, 8);
    const evening = run(12, 12, 10 * 3600_000);
    // 10 gaps of 8s, 11 of 12s, one break of hours: the median of 21 short gaps is 12s.
    expect(secondsPerCard([...evening, ...morning])).toBe(12);
  });
});

describe('estimateMinutes', () => {
  it('rounds up, never says 0 minutes for real work, and 0 for none', () => {
    expect(estimateMinutes(0, 30)).toBe(0);
    expect(estimateMinutes(1, 5)).toBe(1);
    expect(estimateMinutes(12, 30)).toBe(6);
    expect(estimateMinutes(13, 30)).toBe(7);
  });
});

describe('todayHero: what the lead area of Hôm nay says', () => {
  const none = { due: 0, newGrammar: 0, newVocab: 0, newKanji: 0 };
  const base = {
    libraryEmpty: false,
    ready: none,
    reviewedToday: 0,
    secPerCard: 30,
    nextDueAt: null,
  };

  it('asks a newcomer for a level whatever else is true', () => {
    expect(todayHero({ ...base, libraryEmpty: true, ready: { ...none, newKanji: 5 } })).toEqual({
      kind: 'empty',
    });
  });

  it('is done for today when nothing is ready, with the time of the next card', () => {
    const next = at(3600_000);
    expect(todayHero({ ...base, nextDueAt: next })).toEqual({ kind: 'done', nextDueAt: next });
  });

  it('counts every ready card and offers to go on once the learner has started today', () => {
    const ready = { due: 9, newGrammar: 3, newVocab: 5, newKanji: 0 };
    expect(todayHero({ ...base, ready })).toEqual({
      kind: 'ready',
      ...ready,
      total: 17,
      minutes: 9,
      resume: false,
    });
    expect(todayHero({ ...base, ready, reviewedToday: 4 })).toMatchObject({ resume: true });
  });
});

describe('studyWeek: Monday to Sunday of this study week', () => {
  // Saturday 14/11/2026 at noon, local time; study days start at 04:00.
  const now = new Date(2026, 10, 14, 12);

  it('marks the days studied, today, and the days still to come', () => {
    const week = studyWeek([new Date(2026, 10, 9, 20), new Date(2026, 10, 14, 7)], now, 4);
    expect(week.map((d) => d.day)).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ]);
    expect(week.map((d) => d.studied)).toEqual([true, false, false, false, false, true, false]);
    expect(week.findIndex((d) => d.today)).toBe(5);
    expect(week.map((d) => d.future)).toEqual([false, false, false, false, false, false, true]);
  });

  it('counts a review before the cutoff hour toward the day before', () => {
    // 02:00 on Sunday is still Saturday's study day.
    const week = studyWeek([new Date(2026, 10, 15, 2)], new Date(2026, 10, 15, 3), 4);
    expect(week.find((d) => d.today)!.day).toBe('2026-11-14');
    expect(week.find((d) => d.day === '2026-11-14')!.studied).toBe(true);
  });
});

describe('mostMissed', () => {
  const log = (itemId: string | null, rating: number, kind = 'GRAMMAR') => ({
    itemId,
    rating,
    kind,
    expression: itemId ? `expr-${itemId}` : null,
  });

  it('keeps items missed twice or more, most first, leaving out kanji and deleted items', () => {
    const logs = [
      ...[1, 2, 1].map((r) => log('a', r)),
      ...[1, 1].map((r) => log('b', r, 'VOCAB')),
      log('c', 1),
      log('a', 3),
      ...[1, 1, 1].map((r) => log('k', r, 'KANJI')),
      log(null, 1),
      log(null, 1),
    ];
    expect(mostMissed(logs)).toEqual([
      { itemId: 'a', expression: 'expr-a', misses: 3 },
      { itemId: 'b', expression: 'expr-b', misses: 2 },
    ]);
  });
});

describe('forecast', () => {
  it('buckets the cards coming due by UTC day and leaves out what is due now or too far', () => {
    const now = new Date(Date.UTC(2026, 10, 14, 10));
    const days = forecast(
      [
        new Date(Date.UTC(2026, 10, 14, 9)), // already due
        new Date(Date.UTC(2026, 10, 14, 23)),
        new Date(Date.UTC(2026, 10, 16, 1)),
        new Date(Date.UTC(2026, 10, 16, 5)),
        new Date(Date.UTC(2026, 11, 20)), // beyond 14 days
      ],
      now,
    );
    expect(days).toHaveLength(14);
    expect(days[0]).toEqual({ day: '2026-11-14', count: 1 });
    expect(days[2]).toEqual({ day: '2026-11-16', count: 2 });
    expect(days.reduce((s, d) => s + d.count, 0)).toBe(3);
  });
});
