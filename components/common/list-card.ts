// One card in a card list (docs/ui-standard.md › Bố cục): a raised tile with a 2px edge. A card that
// opens a page puts a full-size link under its content, and lifts its own buttons above that link.
export const LIST_CARD = {
  base: 'rounded-xl border-2 border-border p-3 shadow-lift-card transition-colors',
  linked: 'relative hover:bg-muted/40 [&_button]:relative [&_button]:z-10',
  link: 'absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
} as const;
