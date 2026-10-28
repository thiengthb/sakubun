import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import type { EntrySort, ItemType } from '@/lib/library/shared';
import { JLPT_LEVELS } from '@/lib/settings/schema';

// "Từng mục" on Kho chung (7.4i), as pure logic: the search read from the URL (or sent back by the
// page when it loads more), and the line that says how big the result is.

export interface BrowseQuery {
  q: string;
  type: ItemType | 'all';
  level: string;
  sort: EntrySort;
  hideOwned: boolean;
}

export const DEFAULT_BROWSE: BrowseQuery = {
  q: '',
  type: 'all',
  level: 'all',
  sort: 'popular',
  hideOwned: false,
};

const MAX_TEXT = 100;

/** The URL's search (?q, ?type, ?level, ?sort, ?hide=1); anything unknown falls back to the default. */
export function parseBrowseQuery(raw: Record<string, string | undefined>): BrowseQuery {
  const type = raw.type === GRAMMAR_KIND || raw.type === VOCAB_KIND ? raw.type : 'all';
  return {
    q: (raw.q ?? '').trim().slice(0, MAX_TEXT),
    type,
    level: JLPT_LEVELS.find((l) => l === raw.level) ?? 'all',
    sort: raw.sort === 'new' ? 'new' : 'popular',
    hideOwned: raw.hide === '1',
  };
}

/** The same search as URL parameters, leaving defaults out. */
export function browseParams(query: BrowseQuery): URLSearchParams {
  const params = new URLSearchParams({ tab: 'items' });
  if (query.q.trim()) params.set('q', query.q.trim());
  if (query.type !== 'all') params.set('type', query.type);
  if (query.level !== 'all') params.set('level', query.level);
  if (query.sort !== 'popular') params.set('sort', query.sort);
  if (query.hideOwned) params.set('hide', '1');
  return params;
}

// A count, not a date: 7.625 with Vietnamese grouping.
const number = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

/**
 * The page's meta: "518 ngữ pháp, 7.625 từ vựng" for the whole list, one kind when the type is
 * chosen, "120 mục khớp" for a text search.
 */
export function browseMeta(counts: Record<ItemType, number>, query: BrowseQuery): string {
  const total = counts[GRAMMAR_KIND] + counts[VOCAB_KIND];
  if (query.q) return `${number(total)} mục khớp`;
  const parts = [
    query.type !== VOCAB_KIND && `${number(counts[GRAMMAR_KIND])} ngữ pháp`,
    query.type !== GRAMMAR_KIND && `${number(counts[VOCAB_KIND])} từ vựng`,
  ].filter(Boolean);
  return parts.join(', ');
}
