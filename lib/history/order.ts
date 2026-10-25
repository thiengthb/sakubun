import type { HistoryRow } from '@/lib/app/history';

// Search and order for Lịch sử's card list. Pure, so the page and its tests share one rule.

export const HISTORY_SORTS = [
  { value: 'recent', label: 'Mới nhất' },
  { value: 'oldest', label: 'Cũ nhất' },
  { value: 'best', label: 'Kết quả cao nhất' },
  { value: 'worst', label: 'Kết quả thấp nhất' },
] as const;
export type HistorySort = (typeof HISTORY_SORTS)[number]['value'];

type Row = Pick<
  HistoryRow,
  'status' | 'score' | 'rating' | 'createdAt' | 'sourceText' | 'userAnswer' | 'suggested'
>;

/** A 1-4 grade and a 0-100 score on one scale; null for a turn with no result. */
export function resultRank(s: Row): number | null {
  if (s.status !== 'GRADED') return null;
  if (s.rating !== null) return s.rating * 25;
  return s.score;
}

const time = (s: Row) => new Date(s.createdAt).getTime();

/** A new array in the chosen order; turns with no result stay after the ranked ones. */
export function sortHistory<T extends Row>(rows: readonly T[], sort: HistorySort): T[] {
  const out = [...rows];
  if (sort === 'oldest') return out.sort((a, b) => time(a) - time(b));
  if (sort === 'best' || sort === 'worst') {
    const sign = sort === 'best' ? -1 : 1;
    return out.sort((a, b) => {
      const ra = resultRank(a);
      const rb = resultRank(b);
      if (ra === null || rb === null) return ra === rb ? time(b) - time(a) : ra === null ? 1 : -1;
      return ra === rb ? time(b) - time(a) : sign * (ra - rb);
    });
  }
  return out.sort((a, b) => time(b) - time(a));
}

/** The search box reads the prompt, the learner's answer and the reference answer. */
export function matchesSearch(s: Row, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [s.sourceText, s.userAnswer, s.suggested ?? ''].some((t) =>
    t.toLowerCase().includes(needle),
  );
}
