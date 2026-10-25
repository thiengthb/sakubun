import { ratingLabel } from '@/lib/core/format';

// What a turn's result reads as on Lịch sử. A pre-v2 sentence is scored 0-100 and shows the bare
// number, with "62/100" one hover away (thien, Lịch sử round 1); a v2 turn is graded 1-4 and shows
// the grade. The tone colours it: the four grades and four score bands share one scale.

export type ResultTone = 'alert' | 'warn' | 'ok' | 'info' | 'muted';

export interface HistoryResult {
  /** The short form a card shows: "62", "Good", "Bỏ qua". */
  text: string;
  /** The long form behind a hover and in the detail: "62/100", "3/4". */
  full: string;
  tone: ResultTone;
}

const RATING_TONE: Record<number, ResultTone> = { 1: 'alert', 2: 'warn', 3: 'ok', 4: 'info' };

export function scoreTone(score: number): ResultTone {
  if (score < 50) return 'alert';
  if (score < 70) return 'warn';
  if (score < 90) return 'ok';
  return 'info';
}

/** A waiting turn has no result yet: null, and the card says it is waiting instead. */
export function historyResult(row: {
  status: string;
  score: number | null;
  rating: number | null;
}): HistoryResult | null {
  if (row.status === 'SKIPPED') return { text: 'Bỏ qua', full: 'Bỏ qua', tone: 'muted' };
  if (row.status !== 'GRADED') return null;
  if (row.rating !== null) {
    return {
      text: ratingLabel(row.rating),
      full: `${row.rating}/4`,
      tone: RATING_TONE[row.rating] ?? 'muted',
    };
  }
  if (typeof row.score === 'number') {
    return { text: String(row.score), full: `${row.score}/100`, tone: scoreTone(row.score) };
  }
  return { text: 'Chưa có điểm', full: 'Chưa có điểm', tone: 'muted' };
}
