import { describe, expect, it } from 'vitest';
import { groupByDay, timeOfDay } from '@/lib/history/days';

const row = (iso: string, status = 'GRADED', rating: number | null = 3) => ({
  createdAt: iso,
  status,
  score: null,
  rating,
});

// 2026-10-28 14:00 in Hà Nội is 07:00 UTC.
const NOW = new Date('2026-10-28T07:00:00Z');

describe('groupByDay', () => {
  it('names today and yesterday by the app time zone, older days by weekday and date', () => {
    const days = groupByDay(
      [
        row('2026-10-28T01:00:00Z'),
        // 23:30 UTC on the 27th is already the 28th in Hà Nội.
        row('2026-10-27T23:30:00Z'),
        row('2026-10-27T10:00:00Z'),
        row('2026-10-25T03:00:00Z'),
      ],
      NOW,
    );
    expect(days.map((d) => [d.label, d.rows.length])).toEqual([
      ['Hôm nay', 2],
      ['Hôm qua', 1],
      ['Chủ Nhật, 25/10', 1],
    ]);
  });

  it('counts each result tone, leaving waiting turns out', () => {
    const [day] = groupByDay(
      [
        row('2026-10-28T01:00:00Z', 'GRADED', 1),
        row('2026-10-28T01:10:00Z', 'GRADED', 3),
        row('2026-10-28T01:20:00Z', 'GRADED', 3),
        row('2026-10-28T01:30:00Z', 'SKIPPED', null),
        row('2026-10-28T01:40:00Z', 'PENDING', null),
      ],
      NOW,
    );
    expect(day.tally).toEqual({ alert: 1, warn: 0, ok: 2, info: 0, muted: 1 });
  });

  it('keeps the order given, so another sort starts a new group when the day changes', () => {
    const days = groupByDay(
      [row('2026-10-28T01:00:00Z'), row('2026-10-27T10:00:00Z'), row('2026-10-28T02:00:00Z')],
      NOW,
    );
    expect(days.map((d) => d.label)).toEqual(['Hôm nay', 'Hôm qua', 'Hôm nay']);
  });
});

describe('timeOfDay', () => {
  it('reads the hour and minute in the app time zone', () => {
    expect(timeOfDay('2026-10-28T07:20:00Z')).toBe('14:20');
  });
});
