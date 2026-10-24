// The page template's chrome (docs/ui-standard.md › Đầu trang), shared by PageShell and
// PageSkeleton. Both IMPORT these classes: a copied pair drifts, and then the header jumps between
// the skeleton and the page on every navigation.
//
// Laptop: the parent trail is a small line above the title, reserved even when empty, so the title
// never moves between a top page and a nested one. Phone: the menu logo, the title block and the
// actions share one 36px row; the title block is two tight lines (trail over title on a nested
// page, title over meta on a top page).
export const PAGE_CHROME = {
  page: 'w-full min-w-0 max-w-6xl space-y-6 pt-4 pb-10 text-sm md:space-y-8 md:pt-6',
  header: 'space-y-3',
  /** Laptop only: the trail line above the title. */
  trail: 'flex h-4 min-w-0 items-center max-md:hidden',
  stack: 'space-y-1',
  row: 'flex min-h-9 min-w-0 items-center gap-3 md:min-h-7',
  block: 'min-w-0 flex-1',
  /** Phone only: the trail inside the title block, above the title. */
  phoneTrail: 'mb-1 flex h-4 min-w-0 items-center md:hidden',
  title: 'text-lg leading-5 font-extrabold break-words md:text-2xl md:leading-tight',
  meta: 'text-xs leading-4 text-muted-foreground md:mt-1',
  actions: 'flex shrink-0 items-center gap-2',
  pageIcons: 'flex shrink-0 items-center gap-1',
  /** Underline tabs, the full width of the template. */
  tabs: 'flex min-w-0 items-center gap-3 border-b border-border',
} as const;

/** Form template footer: save state left, actions right; sticks to the bottom while the form scrolls. */
export const FORM_FOOTER = {
  bar: 'sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t border-border bg-background px-4 py-3 sm:mx-0 sm:px-0',
  status: 'min-w-0 flex-1 truncate text-xs text-muted-foreground',
  actions: 'ml-auto flex items-center gap-2 max-sm:flex-1 max-sm:[&>*]:flex-1',
} as const;
