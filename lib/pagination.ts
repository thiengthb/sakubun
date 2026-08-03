// Shared rows-per-page choices for EVERY paginated surface (history cards, grammar table, vocab
// table). They used to diverge (10/20/50 on history, 25/50/100 on the tables), so the same control
// offered different choices depending on the page. One list, one default.
//
// The ladder is roughly geometric (5 → 10 → 25 → 50 → 100): each step is a meaningful jump, five
// options fit a dropdown without scrolling, and the ends cover both "just show me a couple" (5) and
// "I want to scan everything" (100). Kept here rather than in `components/ui/data-pagination.tsx`,
// which is a ui-kit copy-in — app choices must not be baked into vendored code.

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;

/** Default rows per page. MUST be a member of PAGE_SIZE_OPTIONS, or the selector renders blank. */
export const PAGE_SIZE_DEFAULT = 25;
