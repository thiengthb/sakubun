import { REVIEW_STATE } from '@/lib/srs/retention';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import { REVIEW_HREF } from '@/lib/library/level-screen';
import {
  wordState,
  type SetItem,
  type StateCounts,
  type WordState,
} from '@/lib/library/level-sets';

// The "Ngoài JLPT" page (U4e, layout B of docs/plans/2026-11-14-u4-kho.md): the learner's groups and
// the items outside JLPT by where they came from, each a card like a set of the level screen, with
// a mark per item and one action. Pure: items, OpenJLPT keys and groups in, cards out.

export type OutsideSource = 'mcp' | 'manual' | 'library';

export const OUTSIDE_SOURCES: readonly OutsideSource[] = ['mcp', 'manual', 'library'];

export const SOURCE_TITLE: Record<OutsideSource, string> = {
  mcp: 'Claude soạn',
  manual: 'Tự viết',
  library: 'Từ bộ chia sẻ',
};

// Item.source as written: MANUAL (the form, the default), MCP (Claude), LIBRARY (taken from Kho
// chung). Anything else is an older import the learner made, so it counts as their own.
export function sourceOf(source: string): OutsideSource {
  if (source === 'MCP') return 'mcp';
  if (source === 'LIBRARY') return 'library';
  return 'manual';
}

export function parseOutsideSource(raw: string): OutsideSource | null {
  return (OUTSIDE_SOURCES as readonly string[]).includes(raw) ? (raw as OutsideSource) : null;
}

export const outsideHref = (source: OutsideSource) => `/resources/outside/${source}`;

// A card draws at most this many marks; the summary line still counts every item.
export const MARK_LIMIT = 60;

export interface OutsideItem extends SetItem {
  kind: string;
  reading: string | null;
  meaningVi: string;
  source: string;
}

export interface ShelfMark {
  id: string;
  expression: string;
  state: WordState;
}

export interface Shelf {
  key: string;
  title: string;
  note: string;
  href: string;
  size: number;
  counts: StateCounts;
  marks: ShelfMark[];
  // "Ôn N" while some are due (Ôn nhanh brings every due card, whatever its level), "Thuộc hết"
  // once all are mastered. Học for one card alone needs Ôn nhanh by scope, which it has not yet.
  action: { label: string; href: string | null } | null;
}

export interface OutsideShelves {
  groups: Shelf[];
  sources: Shelf[];
  outside: number;
  mastered: number;
}

const emptyCounts = (): StateCounts => ({
  none: 0,
  new: 0,
  learning: 0,
  due: 0,
  mastered: 0,
  paused: 0,
});

const itemKey = (kind: string, expression: string) => `${kind}\u0000${expression}`;
export const jlptKey = itemKey;

function shelf(
  base: Pick<Shelf, 'key' | 'title' | 'href'>,
  items: readonly OutsideItem[],
  now: Date,
): Shelf {
  const counts = emptyCounts();
  const marks = items.map((i) => {
    const state = wordState(i, now);
    counts[state] += 1;
    return { id: i.id, expression: i.expression, state };
  });
  const action =
    counts.due > 0
      ? { label: `Ôn ${counts.due}`, href: REVIEW_HREF }
      : items.length > 0 && counts.mastered === items.length
        ? { label: 'Thuộc hết', href: null }
        : null;
  return {
    ...base,
    note: `${items.length} mục`,
    size: items.length,
    counts,
    marks: marks.slice(0, MARK_LIMIT),
    action,
  };
}

/** Grammar and vocab items that match no OpenJLPT entry, oldest first as they came in. */
export function outsideItems<T extends { kind: string; expression: string }>(
  items: readonly T[],
  jlpt: ReadonlySet<string>,
): T[] {
  return items.filter(
    (i) =>
      (i.kind === GRAMMAR_KIND || i.kind === VOCAB_KIND) &&
      !jlpt.has(itemKey(i.kind, i.expression)),
  );
}

export function outsideShelves(
  items: readonly OutsideItem[],
  jlpt: ReadonlySet<string>,
  groups: readonly { id: string; name: string; itemIds: readonly string[] }[],
  now: Date,
): OutsideShelves {
  const byId = new Map(items.map((i) => [i.id, i]));
  const outside = outsideItems(items, jlpt);
  const sources = OUTSIDE_SOURCES.map((source) =>
    shelf(
      { key: source, title: SOURCE_TITLE[source], href: outsideHref(source) },
      outside.filter((i) => sourceOf(i.source) === source),
      now,
    ),
  ).filter((s) => s.size > 0);
  const groupShelves = groups.map((g) => {
    const members = g.itemIds.flatMap((id) => byId.get(id) ?? []);
    return shelf({ key: g.id, title: g.name, href: `/groups/${g.id}` }, members, now);
  });
  // Due or not, as the level board counts "đã thuộc" (level-tally.ts).
  const mastered = outside.filter((i) => !i.suspended && i.state === REVIEW_STATE).length;
  return { groups: groupShelves, sources, outside: outside.length, mastered };
}
