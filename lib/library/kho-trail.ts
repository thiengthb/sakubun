import { KIND_LABEL, type LevelKind } from '@/lib/library/level-screen';
import { SOURCE_TITLE, outsideHref, type OutsideSource } from '@/lib/library/outside-shelves';

// Where a Kho screen sits (KN1, docs/plans/2026-11-19-kho-navigation.md, layout C that thien picked
// on 19/11): Kho, then one of its five ways, then the screens under it. Every Kho screen draws its
// trail from here, so a crumb always leads back up the way the screen hangs, never to the old list
// of every item. Pure: a place in, the parents above it out (the screen itself is its h1).

export type KhoWay = 'levels' | 'outside' | 'groups' | 'kanji' | 'library';

export interface TrailStep {
  label: string;
  href: string;
  /** Kho itself: the trail's root, drawn with Kho's icon. */
  root?: boolean;
  /** A loading screen's step that waits on data. */
  pending?: boolean;
}

export const KHO_HREF = '/resources';

// The five ways, in the order the sidebar lists them (KN2). Nhóm and Kanji still open the tabs of
// the list of every item until they get pages of their own (KN2).
export const KHO_WAYS: Record<KhoWay, { label: string; href: string }> = {
  levels: { label: 'Theo cấp JLPT', href: '/resources' },
  outside: { label: 'Ngoài JLPT', href: '/resources/outside' },
  groups: { label: 'Nhóm', href: '/resources/all?tab=groups' },
  kanji: { label: 'Kanji', href: '/resources/all?tab=kanji' },
  library: { label: 'Kho chung', href: '/library' },
};

export const levelHref = (level: string, kind: LevelKind) => `/resources/level/${level}/${kind}`;
export const levelLabel = (level: string, kind: LevelKind) => `${level} · ${KIND_LABEL[kind]}`;
export const setLabel = (n: number) => `Chặng ${n}`;

export type KhoPlace =
  /** Kho's own pages: the level board, Ngoài JLPT, Kho chung's front page, adding an item. */
  | { way: 'home' }
  | { way: 'levels'; level?: string; kind?: LevelKind; set?: number }
  | { way: 'outside'; source?: OutsideSource }
  | { way: 'groups' | 'kanji' | 'library' }
  /** A loading screen that does not know the place yet. */
  | { way: 'pending' };

/** The screens above a place, Kho first. A screen at `place` shows these as its trail. */
export function khoTrail(place: KhoPlace): TrailStep[] {
  const root: TrailStep = { label: 'Kho', href: KHO_HREF, root: true };
  if (place.way === 'home') return [root];
  if (place.way === 'pending') return [root, { label: 'Đang tải', href: KHO_HREF, pending: true }];
  const steps: TrailStep[] = [root, KHO_WAYS[place.way]];
  if (place.way === 'levels' && place.level && place.kind) {
    steps.push({
      label: levelLabel(place.level, place.kind),
      href: levelHref(place.level, place.kind),
    });
    if (place.set)
      steps.push({
        label: setLabel(place.set),
        href: `${levelHref(place.level, place.kind)}/${place.set}`,
      });
  }
  if (place.way === 'outside' && place.source)
    steps.push({ label: SOURCE_TITLE[place.source], href: outsideHref(place.source) });
  return steps;
}

/** The set a word falls in, counted as the level screen cuts it: a repeated word counts where it first appears. */
export function setOfWord(
  ordered: readonly string[],
  expression: string,
  size: number,
): number | null {
  const seen = new Set<string>();
  for (const e of ordered) {
    if (seen.has(e)) continue;
    if (e === expression) return Math.floor(seen.size / size) + 1;
    seen.add(e);
  }
  return null;
}
