import type { WordState } from '@/lib/library/level-sets';

// How a word's state is drawn on the level and set screens (U4c, docs/plans/2026-11-14-u4-kho.md).
// Square tiles in the app's orange, deeper once mastered (thien picked B in round 3, 18/11); every
// mark is read with a label or a summary line beside it, as the colour alone says nothing.

/** The small square of a set card and of the legend. */
export const MARK: Record<WordState, string> = {
  mastered: 'bg-accent-brand/75',
  learning: 'bg-accent-brand/30',
  due: 'bg-warn/70',
  new: 'bg-muted-foreground/15',
  none: 'border border-dashed border-muted-foreground/50',
  paused: 'bg-muted',
};

/** The same states as a tile with text on it: lighter, so the word stays easy to read. */
export const TILE: Record<WordState, string> = {
  mastered: 'border-accent-brand/50 bg-accent-brand/30',
  learning: 'border-accent-brand/20 bg-accent-brand/8',
  due: 'border-warn/70 bg-warn/15',
  new: 'border-border bg-muted/60',
  none: 'border-dashed border-muted-foreground/50',
  paused: 'border-border bg-muted text-muted-foreground',
};
