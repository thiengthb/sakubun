// How big Hội thoại draws a script (thien, 2026-11-07): a laptop's usual text is too small to read
// a chat by. The learner steps through these sizes with + and − or the page's menu; each browser
// keeps its own, since a laptop and a phone want different ones.
export const TEXT_SIZES = [1, 1.15, 1.3, 1.5, 1.75] as const;

export function stepTextSize(index: number, by: 1 | -1): number {
  const at = Number.isInteger(index) ? index : 0;
  return Math.min(TEXT_SIZES.length - 1, Math.max(0, at + by));
}

export function textScale(index: number): number {
  return TEXT_SIZES[Math.min(TEXT_SIZES.length - 1, Math.max(0, Math.trunc(index) || 0))];
}

/** "130%": the size as the menu shows it. */
export const textSizeLabel = (index: number) => `${Math.round(textScale(index) * 100)}%`;
