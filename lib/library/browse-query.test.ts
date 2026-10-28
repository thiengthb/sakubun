import { describe, expect, it } from 'vitest';
import {
  browseMeta,
  browseParams,
  DEFAULT_BROWSE,
  parseBrowseQuery,
} from '@/lib/library/browse-query';

describe('parseBrowseQuery', () => {
  it('reads a full search and round-trips it through the URL', () => {
    const query = parseBrowseQuery({
      q: ' 店 ',
      type: 'VOCAB',
      level: 'N4',
      sort: 'new',
      hide: '1',
    });
    expect(query).toEqual({ q: '店', type: 'VOCAB', level: 'N4', sort: 'new', hideOwned: true });
    expect(Object.fromEntries(browseParams(query))).toEqual({
      tab: 'items',
      q: '店',
      type: 'VOCAB',
      level: 'N4',
      sort: 'new',
      hide: '1',
    });
  });

  it('falls back to the default on anything it does not know', () => {
    expect(parseBrowseQuery({ type: 'GROUP', level: 'N6', sort: 'random', hide: 'yes' })).toEqual(
      DEFAULT_BROWSE,
    );
    expect(parseBrowseQuery({ q: 'あ'.repeat(500) }).q).toHaveLength(100);
    expect(Object.fromEntries(browseParams(DEFAULT_BROWSE))).toEqual({ tab: 'items' });
  });
});

describe('browseMeta', () => {
  const counts = { GRAMMAR: 518, VOCAB: 7625 };

  it('gives the real size of Kho chung, by kind', () => {
    expect(browseMeta(counts, DEFAULT_BROWSE)).toBe('518 ngữ pháp, 7.625 từ vựng');
    expect(browseMeta({ GRAMMAR: 0, VOCAB: 7625 }, { ...DEFAULT_BROWSE, type: 'VOCAB' })).toBe(
      '7.625 từ vựng',
    );
  });

  it('counts the matches of a text search', () => {
    expect(browseMeta({ GRAMMAR: 3, VOCAB: 1200 }, { ...DEFAULT_BROWSE, q: '店' })).toBe(
      '1.203 mục khớp',
    );
  });
});
