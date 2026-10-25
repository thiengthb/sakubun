// A group's flashcard deck as the learner left it: the order (the group's, or a shuffle of it) and
// how far they got. Browsing only; nothing here touches the schedule.

export interface DeckProgress {
  /** The shuffled order, or null for the group's own order. */
  shuffled: string[] | null;
  /** The card on screen, from 0; `ids.length` means the deck is finished. */
  index: number;
}

export const FRESH_DECK: DeckProgress = { shuffled: null, index: 0 };

/** Fisher-Yates over a copy, with an injectable source of randomness for tests. */
export function shuffleIds(ids: readonly string[], rand: () => number = Math.random): string[] {
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The order to show `ids` in, from saved progress that may predate the group's latest edit: items
 * taken out of the group drop out of a saved shuffle, items added since go to its end, and the
 * position stays on a real card (or at the end).
 */
export function resumeDeck(
  ids: readonly string[],
  saved: DeckProgress | null | undefined,
): { order: string[]; index: number } {
  let order = [...ids];
  if (saved?.shuffled) {
    const present = new Set(ids);
    const kept = saved.shuffled.filter((id) => present.has(id));
    const keptSet = new Set(kept);
    order = [...kept, ...ids.filter((id) => !keptSet.has(id))];
  }
  const raw = Number.isInteger(saved?.index) ? (saved?.index ?? 0) : 0;
  return { order, index: Math.max(0, Math.min(raw, order.length)) };
}
