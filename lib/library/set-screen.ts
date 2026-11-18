import type { LevelSet, SetWord } from '@/lib/library/level-sets';
import { setSummary, UNIT, type LevelContext } from '@/lib/library/level-screen';
import { cellHref, libraryLevelHref } from '@/lib/library/level-tally';

// The set screen (U4c3, docs/plans/2026-11-14-u4-kho.md): one set of a level as a map of its
// words, one open beside the map. Pure: the links, the neighbours and which word opens first.

type Where = Pick<LevelContext, 'level' | 'kind'>;

export function setHref(ctx: Where, set: number): string {
  return `${cellHref(ctx.level, ctx.kind)}/${set}`;
}

/** The set a URL names: a whole number from 1 to the level's last set, written plainly. */
export function parseSetNumber(raw: string, total: number): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const n = Number(raw);
  return n <= total ? n : null;
}

export function setNeighbours(
  set: number,
  total: number,
): { prev: number | null; next: number | null } {
  return { prev: set > 1 ? set - 1 : null, next: set < total ? set + 1 : null };
}

/** "20 từ · 7 thuộc · 3 đến hạn", under the set's title. */
export function setMeta(set: LevelSet, ctx: Where): string {
  const summary = setSummary(set.counts);
  return `${set.words.length} ${UNIT[ctx.kind]}${summary ? ` · ${summary}` : ''}`;
}

// The word open when the screen loads: the first one asking for something (due, then never
// studied), else the first of the set.
export function firstOpenWord(set: LevelSet): number {
  for (const state of ['due', 'new'] as const) {
    const i = set.words.findIndex((w) => w.state === state);
    if (i >= 0) return i;
  }
  return 0;
}

/** The detail's link: the learner's own item, or the level in Kho chung to take it from. */
export function wordLink(word: SetWord, ctx: Where): { label: string; href: string } {
  if (word.item) return { label: 'Mở mục', href: `/resources/${word.item.id}` };
  return { label: 'Lấy ở Kho chung', href: libraryLevelHref(ctx.level, ctx.kind) };
}
