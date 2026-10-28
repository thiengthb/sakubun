// One card in a card list (docs/ui-standard.md › Bố cục): a raised tile with a 2px edge. A card that
// opens a page puts a full-size link under its content, and lifts its own buttons above that link, and
// any text cut short, so its tooltip can open (Truncate passes a click on to the link). Something on
// the card's edge (the "Mới" tag) is placed against the card.
export const LIST_CARD = {
  base: 'relative rounded-xl border-2 border-border p-3 shadow-lift-card transition-colors',
  linked:
    'hover:bg-muted/40 [&_button]:relative [&_button]:z-10 [&_[data-truncated]]:relative [&_[data-truncated]]:z-10',
  /** The row of a boxed list that is open beside it (Lịch sử's turn in the side panel). */
  chosen: 'bg-brand-wash hover:bg-brand-wash',
  link: 'absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
} as const;
