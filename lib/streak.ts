// Study-day streak, computed dynamically from review days (never stored — todo convention).
// Loss-soft: ONE missed day between study days doesn't break the chain (grace day), and today
// not yet studied doesn't break it either.

const DAY_MS = 86400000;

function dayNumber(dateKey: string): number {
  return Math.floor(new Date(`${dateKey}T00:00:00Z`).getTime() / DAY_MS);
}

/** Local-time study-day key with the Anki-style cutoff (before cutoffHour = previous day). */
export function studyDayKey(date: Date, cutoffHour: number): string {
  const shifted = new Date(date.getTime() - cutoffHour * 3600000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
}

export interface Streak {
  current: number;
  longest: number;
}

/**
 * @param studyDays distinct study-day keys "YYYY-MM-DD" (already cutoff-adjusted)
 * @param todayKey today's study-day key
 */
export function computeStreak(studyDays: string[], todayKey: string): Streak {
  if (studyDays.length === 0) return { current: 0, longest: 0 };
  const days = [...new Set(studyDays)].map(dayNumber).sort((a, b) => a - b);

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    // gap of 1 = consecutive; gap of 2 = one missed day (grace) — chain survives.
    run = days[i] - days[i - 1] <= 2 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  // Current streak counts only if the last study day is today or within the grace window.
  const today = dayNumber(todayKey);
  const last = days[days.length - 1];
  if (today - last > 2) return { current: 0, longest };
  let current = 1;
  for (let i = days.length - 1; i > 0; i -= 1) {
    if (days[i] - days[i - 1] <= 2) current += 1;
    else break;
  }
  return { current, longest };
}
