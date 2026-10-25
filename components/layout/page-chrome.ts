// The page template's chrome (docs/ui-standard.md › Đầu trang), shared by PageShell and
// PageSkeleton. Both IMPORT these classes: a copied pair drifts, and then the header jumps between
// the skeleton and the page on every navigation.
//
// Laptop: the parent trail is a small line above the title, reserved even when empty, so the title
// never moves between a top page and a nested one. Phone: the menu logo, the title block and the
// actions share one 36px row; the title block is two tight lines (trail over title on a nested
// page, title over meta on a top page).
export const PAGE_CHROME = {
  // A flex column, not space-y: a tab's hidden panels after the open one would each keep a margin.
  page: 'flex w-full min-w-0 max-w-6xl flex-col gap-6 pt-4 pb-10 text-sm md:gap-8 md:pt-6 md:pb-8',
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
  /** Phone, nested page: the trail holds the block's small line, so the meta drops below the row. */
  phoneMeta: 'text-xs leading-4 text-muted-foreground md:hidden',
  /** Phone, `actionsOnPhone="split"`: the actions get their own row and share it equally. */
  phoneActions: 'grid auto-cols-fr grid-flow-col gap-2 md:hidden [&>*]:w-full',
  actions: 'flex shrink-0 items-center gap-2',
  pageIcons: 'flex shrink-0 items-center gap-1',
  /** Underline tabs, the full width of the template. */
  tabs: 'flex min-w-0 items-center gap-3 border-b border-border',
} as const;

// The detail header (docs/ui-standard.md › Đầu trang), for a page that has a lot to say about one
// thing: a meaning, a level, a state. thien (item detail rounds 1 and 2, 2026-10-25) found the
// 36px phone row too tight for that, so here the phone row holds only the logo, the trail and the
// star, and the title gets a line of its own; the facts sit under it as labelled values.
export const DETAIL_CHROME = {
  header: 'space-y-4 md:space-y-6',
  head: 'space-y-3 md:space-y-4',
  /** Phone only: logo, trail, page icons. */
  phoneTop: 'flex h-9 min-w-0 items-center gap-3 md:hidden',
  phoneTrail: 'flex min-w-0 flex-1 items-center',
  titleRow: 'flex items-start gap-4',
  titleBlock: 'min-w-0 flex-1 space-y-2 md:space-y-3',
  title: 'text-2xl leading-tight font-extrabold break-words md:text-3xl',
  subtitle: 'space-y-1 text-base',
  /** Laptop only: actions and page icons beside the title. */
  side: 'flex shrink-0 items-center gap-2 max-md:hidden',
  facts:
    'grid grid-cols-2 gap-x-4 gap-y-2 max-md:rounded-sm max-md:bg-muted/70 max-md:px-3 max-md:py-2.5 md:flex md:gap-x-10',
  fact: 'min-w-0 space-y-0.5',
  factLabel: 'text-xs text-muted-foreground',
  factValue: 'flex items-center gap-1 truncate text-sm font-bold [&>svg]:size-3.5',
} as const;

/** Form template footer: save state left, actions right; sticks to the bottom while the form scrolls. */
export const FORM_FOOTER = {
  bar: 'sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t border-border bg-background px-4 py-3 sm:mx-0 sm:px-0',
  status: 'min-w-0 flex-1 truncate text-xs text-muted-foreground',
  actions: 'ml-auto flex items-center gap-2 max-sm:flex-1 max-sm:[&>*]:flex-1',
} as const;
