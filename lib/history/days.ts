import { APP_TIME_ZONE } from '@/lib/core/format';
import { historyResult, type ResultTone } from '@/lib/history/result';

// Lịch sử as a timeline (thien, 7.4 History B): turns gathered by the day they were set, in the
// app's time zone, each day with how its results came out. Pure, so the page and its tests share
// one rule.

type Row = {
  createdAt: Date | string;
  status: string;
  score: number | null;
  rating: number | null;
};

export interface HistoryDay<T> {
  /** The calendar day, dd/mm/yyyy in the app's time zone. */
  key: string;
  /** "Hôm nay", "Hôm qua", or the weekday and date. */
  label: string;
  rows: T[];
  /** How many of the day's turns came out in each tone; waiting turns are not counted. */
  tally: Record<ResultTone, number>;
}

const dayKey = new Intl.DateTimeFormat('vi-VN', {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const dayName = new Intl.DateTimeFormat('vi-VN', {
  timeZone: APP_TIME_ZONE,
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
});
const clock = new Intl.DateTimeFormat('vi-VN', {
  timeZone: APP_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const DAY_MS = 86_400_000;

/** The hour and minute a turn was set, "14:20". */
export const timeOfDay = (value: Date | string) => clock.format(new Date(value));

const emptyTally = (): Record<ResultTone, number> => ({
  alert: 0,
  warn: 0,
  ok: 0,
  info: 0,
  muted: 0,
});

/** Consecutive rows of one day go together, in the order given. */
export function groupByDay<T extends Row>(
  rows: readonly T[],
  now: Date = new Date(),
): HistoryDay<T>[] {
  const today = dayKey.format(now);
  // Vietnam keeps no daylight saving, so a day back is always 24 hours.
  const yesterday = dayKey.format(new Date(now.getTime() - DAY_MS));
  const days: HistoryDay<T>[] = [];
  for (const row of rows) {
    const at = new Date(row.createdAt);
    const key = dayKey.format(at);
    let day = days.at(-1);
    if (!day || day.key !== key) {
      const label = key === today ? 'Hôm nay' : key === yesterday ? 'Hôm qua' : dayName.format(at);
      day = {
        key,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        rows: [],
        tally: emptyTally(),
      };
      days.push(day);
    }
    day.rows.push(row);
    const result = historyResult(row);
    if (result) day.tally[result.tone] += 1;
  }
  return days;
}
