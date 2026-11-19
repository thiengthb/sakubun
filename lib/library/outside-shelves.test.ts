import { describe, expect, it } from 'vitest';
import { REVIEW_STATE } from '@/lib/srs/retention';
import {
  jlptKey,
  MARK_LIMIT,
  outsideShelves,
  parseOutsideSource,
  sourceOf,
  type OutsideItem,
} from './outside-shelves';

const NOW = new Date('2030-01-15T03:00:00.000Z');
const PAST = new Date('2030-01-14T00:00:00.000Z');
const LATER = new Date('2030-02-01T00:00:00.000Z');

let n = 0;
const item = (over: Partial<OutsideItem> = {}): OutsideItem => ({
  id: `i${++n}`,
  kind: 'VOCAB',
  expression: `語${n}`,
  reading: null,
  meaningVi: 'nghĩa',
  source: 'MANUAL',
  suspended: false,
  state: null,
  due: null,
  lapses: 0,
  ...over,
});
const mastered = { state: REVIEW_STATE, due: LATER };

describe('outsideShelves (U4e)', () => {
  it('leaves out OpenJLPT items and kanji, and splits the rest by source', () => {
    const jlpt = new Set([jlptKey('VOCAB', '店')]);
    const shelves = outsideShelves(
      [
        item({ expression: '店' }),
        item({ kind: 'KANJI', expression: '店' }),
        item({ source: 'MCP' }),
        item({ source: 'MCP', ...mastered }),
        item({ source: 'LIBRARY' }),
        item({ source: 'MANUAL' }),
      ],
      jlpt,
      [],
      NOW,
    );
    expect(shelves.outside).toBe(4);
    expect(shelves.mastered).toBe(1);
    expect(shelves.sources.map((s) => [s.key, s.size, s.href])).toEqual([
      ['mcp', 2, '/resources/outside/mcp'],
      ['manual', 1, '/resources/outside/manual'],
      ['library', 1, '/resources/outside/library'],
    ]);
  });

  it('hides a source with no item', () => {
    const shelves = outsideShelves([item({ source: 'MCP' })], new Set(), [], NOW);
    expect(shelves.sources.map((s) => s.key)).toEqual(['mcp']);
  });

  it('offers Ôn while items are due, Thuộc hết once all are mastered, else nothing', () => {
    const due = outsideShelves([item({ state: REVIEW_STATE, due: PAST })], new Set(), [], NOW);
    expect(due.sources[0]!.action).toEqual({ label: 'Ôn 1', href: '/review' });
    const done = outsideShelves([item(mastered)], new Set(), [], NOW);
    expect(done.sources[0]!.action).toEqual({ label: 'Thuộc hết', href: null });
    const fresh = outsideShelves([item()], new Set(), [], NOW);
    expect(fresh.sources[0]!.action).toBeNull();
    expect(fresh.sources[0]!.counts.new).toBe(1);
  });

  it('draws a group with every member, JLPT ones too, and opens the group', () => {
    const shop = item({ expression: '店' });
    const own = item(mastered);
    const shelves = outsideShelves(
      [shop, own],
      new Set([jlptKey('VOCAB', '店')]),
      [{ id: 'g1', name: 'Bài dịch', itemIds: [shop.id, own.id, 'gone'] }],
      NOW,
    );
    expect(shelves.groups).toHaveLength(1);
    expect(shelves.groups[0]).toMatchObject({
      title: 'Bài dịch',
      href: '/groups/g1',
      size: 2,
      note: '2 mục',
    });
    expect(shelves.groups[0]!.marks.map((m) => m.state)).toEqual(['new', 'mastered']);
  });

  it('draws at most MARK_LIMIT marks but counts every item', () => {
    const many = Array.from({ length: MARK_LIMIT + 5 }, () => item());
    const shelf = outsideShelves(many, new Set(), [], NOW).sources[0]!;
    expect(shelf.marks).toHaveLength(MARK_LIMIT);
    expect(shelf.size).toBe(MARK_LIMIT + 5);
    expect(shelf.counts.new).toBe(MARK_LIMIT + 5);
  });

  it('reads Item.source and the page path', () => {
    expect([sourceOf('MCP'), sourceOf('LIBRARY'), sourceOf('MANUAL'), sourceOf('CSV')]).toEqual([
      'mcp',
      'library',
      'manual',
      'manual',
    ]);
    expect(parseOutsideSource('mcp')).toBe('mcp');
    expect(parseOutsideSource('kanji')).toBeNull();
  });
});
