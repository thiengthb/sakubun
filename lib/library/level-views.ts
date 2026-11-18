import type { LevelSets } from '@/lib/library/level-sets';
import type { LevelContext } from '@/lib/library/level-screen';
import { cellHref } from '@/lib/library/level-tally';
import { wordCard, type WordCard } from '@/lib/library/set-screen';

// The level screen's ways to look at a level (U4c4, docs/plans/2026-11-14-u4-kho.md): its sets and
// a tile per word of the whole level (a list to look a word up comes in U4c4b). The view rides in
// the address (?view=), so the server sends only what the open view shows. Pure.

export const LEVEL_VIEWS = ['sets', 'map'] as const;
export type LevelView = (typeof LEVEL_VIEWS)[number];

type Where = Pick<LevelContext, 'level' | 'kind'>;

/** The view an address asks for; anything else opens the sets. */
export function parseLevelView(raw: string | string[] | undefined): LevelView {
  return typeof raw === 'string' && (LEVEL_VIEWS as readonly string[]).includes(raw)
    ? (raw as LevelView)
    : 'sets';
}

export function levelViewHref(ctx: Where, view: LevelView): string {
  const base = cellHref(ctx.level, ctx.kind);
  return view === 'sets' ? base : `${base}?view=${view}`;
}

/** Every word of the level in the sets' order, each knowing its set. */
export function levelWords(sets: LevelSets, ctx: Where): WordCard[] {
  return sets.sets.flatMap((set) => set.words.map((w) => wordCard(w, set.number, ctx)));
}
