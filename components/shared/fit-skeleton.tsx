'use client';

import { Fragment, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useFitRows } from '@/components/ui/use-fit-rows';
import { useSessionState } from '@/components/shared/use-session-state';

// Auto-fitting skeletons — the loading-state twin of the viewport-fit pagination (`useFitRows` +
// pure math `lib/fit-rows.ts`). A route's `loading.tsx` renders as many placeholder rows/cards as
// will ACTUALLY fit the viewport — the SAME count the real list computes — so the skeleton fills the
// screen and the hand-off to real data doesn't jump (a short 8-row skeleton popping to 16 real rows,
// or an 8-row skeleton overflowing a laptop viewport, were the two drifts this fixes).
//
// Three contracts:
//   1. FIT — keep each placeholder item's height equal to the real row/card. Every height in this file
//      is MEASURED from the running app (see the numbers below), not estimated. Fixed-height items make
//      the pitch exact → the count converges in one step (no oscillation the deadband must damp).
//   2. SHAPE — mirror the real ROW, not a single gray bar: the same columns, the same header strip, and
//      the pagination footer the real table always renders.
//   3. BREAKPOINT — mirror what the page shows AT THAT WIDTH. The data table is a TABLE from `md` up and
//      a CARD LIST below it (`DataTable`'s `renderCard`), so this file renders both and hides each at
//      the other's breakpoint, exactly as the real one does. Drawing a table on a phone (what this did
//      until 2026-08-05) is a skeleton for a layout the phone never gets.
//
// Before the first measure (and during SSR) the hook returns null → we render `fallback` items; the
// client measurement corrects within a frame. A container hidden at the current breakpoint measures 0
// and `useFitRows` skips it, so the two halves never fight over the count.
//
// MEASURED PITCHES (2026-08-05, /resources with 12 rows, 390px and 1440px):
//   table row 49 · resource card (phone) 110 + 8 gap · group card 86 + 12 gap · group member row 64
//   picker row 71 · history card 120 + 12 gap

/**
 * The one primitive: a container whose child COUNT is fitted to the viewport. `item` is the single
 * placeholder ELEMENT, repeated `count` times; keep its height equal to the real surface's row/card
 * so the fit matches. The ref sits on the container itself, so for a grid the live column count is
 * read from its `grid-template-columns` — pass the responsive `grid ...` classes in `className` and
 * `grid`.
 *
 * `item` is an element, NOT a `render()` callback, on purpose: every placeholder in a fitted list is
 * identical (the index was never used), and a route's `loading.tsx` is a SERVER component — handing
 * this client component a function prop throws "Functions cannot be passed directly to Client
 * Components" at request time, which the error boundary then shows as a broken page (it did, on
 * `/groups/[id]`, 2026-07-26). An element crosses the RSC boundary fine, so the boundary-safe shape
 * is the only shape the type allows.
 */
export function FitList({
  rowHeight,
  rowGap = 0,
  grid = false,
  auto = true,
  fallback,
  min,
  max,
  className,
  item,
}: {
  /** Item pitch in px — MUST match the real row/card height. Pre-measure fallback for the math. */
  rowHeight: number;
  /** Vertical gap between items in px (a grid's row-gap; 0 for a divide-y list/table). */
  rowGap?: number;
  /** Read the live column count from `grid-template-columns` (a responsive card grid). */
  grid?: boolean;
  /** When false, always render `fallback` items (a surface that is not viewport-paginated). */
  auto?: boolean;
  /** Count rendered on the server and until the first client measure. */
  fallback: number;
  min?: number;
  max?: number;
  className?: string;
  /** The placeholder element, repeated to fill the fitted count. Must be RSC-serializable. */
  item: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fit = useFitRows({ topRef: ref, rowHeight, rowGap, grid, min, max });
  const count = auto ? (fit ?? fallback) : fallback;
  return (
    <div ref={ref} className={className}>
      {/* Fragment carries the key without adding a DOM node, so the container's childElementCount
          (what useFitRows measures) equals the item count. */}
      {Array.from({ length: count }, (_, i) => (
        <Fragment key={i}>{item}</Fragment>
      ))}
    </div>
  );
}

/**
 * Pick the body shape by the tab the user will actually land on.
 *
 * A tabbed page restores its last tab from sessionStorage (`useSessionState`), so a fixed skeleton is
 * right only for whoever last used the default tab: opening /resources on "Nhóm" drew a TABLE that then
 * snapped to a card grid. This reads the SAME key through the SAME hook, so the two cannot disagree
 * about which tab is next — and it is SSR-safe by construction (server render = `initial`, then one
 * committed re-render).
 *
 * `shapes` holds elements, not functions — same RSC-boundary rule as `FitList`'s `item`.
 */
export function TabbedSkeleton({
  storeKey,
  urlKey,
  initial,
  shapes,
}: {
  storeKey: string;
  urlKey?: string;
  initial: string;
  shapes: Record<string, ReactNode>;
}) {
  const [tab] = useSessionState(storeKey, initial, urlKey);
  return <>{shapes[tab] ?? shapes[initial]}</>;
}

/** The pagination bar the real DataTable / paged list always renders below its rows. */
function PaginationFooterSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* "N–M / total" count line. */}
      <Skeleton className="h-4 w-40" />
      <div className="flex items-center gap-2">
        {/* rows-per-page selector + the page-number buttons. */}
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-8 w-44 rounded-md" />
      </div>
    </div>
  );
}

/** One phone-width resource CARD (the below-md replacement for a table row) — see `ResourceCard`:
 *  band 1 identity + actions, band 2 meaning (2 lines), band 3 meta. Measured 110px tall. */
const RESOURCE_CARD = (
  <div
    data-skeleton-row
    className="flex flex-col gap-1.5 rounded-lg border border-border/70 p-3"
    style={{ height: 110 }}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Skeleton className="size-6 shrink-0 rounded-full" />
        <Skeleton className="h-4 min-w-0 flex-1" style={{ maxWidth: 150 }} />
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="size-7 rounded-md" />
      </div>
    </div>
    <Skeleton className="h-4 w-full" />
    <div className="flex items-center gap-2">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-10 rounded-md" />
    </div>
  </div>
);

/** One table ROW placeholder — the same columns the real row sheds at the same breakpoints. */
const TABLE_ROW = (
  <div data-skeleton-row className="flex h-12 items-center gap-3">
    {/* expression cell: the SpokenLine play glyph + the term text. */}
    <Skeleton className="size-6 shrink-0 rounded-full" />
    <Skeleton className="h-4 min-w-0 flex-[3]" />
    {/* meaning */}
    <Skeleton className="hidden h-4 min-w-0 flex-[2] sm:block" />
    {/* state / due */}
    <Skeleton className="hidden h-4 w-16 md:block" />
    <Skeleton className="hidden h-4 w-16 lg:block" />
    {/* actions: star · quick-look · ⋮ menu. */}
    <div className="ml-auto flex shrink-0 items-center gap-1.5">
      <Skeleton className="size-7 rounded-md" />
      <Skeleton className="size-7 rounded-md" />
      <Skeleton className="size-7 rounded-md" />
    </div>
  </div>
);

/**
 * A data-list placeholder that mirrors the real `DataTable` AT EACH WIDTH: viewport-fitted cards below
 * `md`, the bordered table with its column-header strip from `md` up, and the pagination footer both
 * share.
 */
export function TableSkeleton({
  rows = 8,
  rowHeight = 49,
  cardHeight = 110,
  auto = true,
  footer = true,
  min,
  max,
}: {
  /** Fallback row count (server / pre-measure; or the fixed count when `auto` is off). */
  rows?: number;
  /** Table row pitch in px — MUST match the real row (`h-12` + border = 49). */
  rowHeight?: number;
  /** Phone card pitch in px — MUST match the real `ResourceCard` (measured 110). */
  cardHeight?: number;
  auto?: boolean;
  /** Render the pagination footer below the list (the real DataTable always does). */
  footer?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-3">
      {/* Below md — the card list (`flex flex-col gap-2`, exactly as DataTable renders it). */}
      <FitList
        rowHeight={cardHeight}
        rowGap={8}
        auto={auto}
        fallback={Math.min(rows, 5)}
        min={min}
        max={max}
        className="flex flex-col gap-2 md:hidden"
        item={RESOURCE_CARD}
      />
      {/* md and up — the table. */}
      <div className="space-y-2 rounded-lg border p-4 max-md:hidden">
        {/* Column header strip (mirrors <thead>): short header labels over the same columns. */}
        <div className="flex items-center gap-3 border-b pb-2">
          <div className="size-6 shrink-0" />
          <Skeleton className="h-3 w-24 flex-[3]" style={{ maxWidth: 100 }} />
          <Skeleton className="hidden h-3 flex-[2] sm:block" style={{ maxWidth: 80 }} />
          <Skeleton className="hidden h-3 w-12 md:block" />
          <Skeleton className="hidden h-3 w-12 lg:block" />
          <div className="ml-auto w-[126px] shrink-0" />
        </div>
        <FitList
          rowHeight={rowHeight}
          auto={auto}
          fallback={rows}
          min={min}
          max={max}
          className="divide-y"
          item={TABLE_ROW}
        />
      </div>
      {footer && <PaginationFooterSkeleton />}
    </div>
  );
}

/**
 * A uniform CARD GRID placeholder — the shape the groups tab uses (`grid gap-3 sm:grid-cols-2
 * lg:grid-cols-3`, cards measured 86px). Same at every width; only the column count changes, and
 * `FitList` reads that from the live `grid-template-columns`.
 */
export function CardsSkeleton({
  count = 6,
  rowHeight = 86,
  columns = 'sm:grid-cols-2 lg:grid-cols-3',
  rowGap = 12,
  footer = true,
  min,
  max,
}: {
  count?: number;
  rowHeight?: number;
  columns?: string;
  rowGap?: number;
  footer?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-3">
      <FitList
        rowHeight={rowHeight}
        rowGap={rowGap}
        grid
        fallback={count}
        min={min}
        max={max}
        className={cn('grid gap-3', columns)}
        item={
          <div
            data-skeleton-row
            className="flex flex-col gap-1.5 rounded-lg border border-border/70 p-3"
            style={{ height: rowHeight }}
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 min-w-0 flex-1" style={{ maxWidth: 140 }} />
              <Skeleton className="size-7 shrink-0 rounded-md" />
            </div>
            <Skeleton className="h-3 w-4/5" />
            <div className="mt-auto flex items-center gap-2">
              <Skeleton className="h-4 w-16 rounded-md" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        }
      />
      {footer && <PaginationFooterSkeleton />}
    </div>
  );
}

/**
 * A responsive card-grid placeholder — viewport-fitted tiles on the same column ramp the real card
 * lists use, each tile shaped like the real history card (a header row of badges + score + time + star,
 * then a play-line body). `rowHeight` is the real card pitch (history = 120) and the tile height, so
 * the measured fit matches.
 */
export function CardGridSkeleton({
  count = 6,
  rowHeight = 120,
  columns = 'sm:grid-cols-2 lg:grid-cols-3',
  rowGap = 12,
  auto = true,
  footer = true,
  min,
  max,
}: {
  count?: number;
  /** Card pitch in px — MUST match the real card height. Also the rendered tile height. */
  rowHeight?: number;
  columns?: string;
  /** Grid row-gap in px (default `gap-3` = 12). */
  rowGap?: number;
  auto?: boolean;
  /** Render the pagination footer below the grid (the real paged list always does). */
  footer?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-3">
      <FitList
        rowHeight={rowHeight}
        rowGap={rowGap}
        grid
        auto={auto}
        fallback={count}
        min={min}
        max={max}
        className={cn('grid gap-3', columns)}
        item={
          <div
            data-skeleton-row
            className="flex flex-col gap-3 rounded-lg border p-4"
            style={{ height: rowHeight }}
          >
            {/* header: direction + type badges · score · time (ml-auto) · star. */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="ml-auto h-4 w-14" />
              <Skeleton className="size-6 shrink-0 rounded-md" />
            </div>
            {/* body: the đề line — a play glyph + one truncated line. */}
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <Skeleton className="h-4 min-w-0 flex-1" style={{ maxWidth: '70%' }} />
            </div>
          </div>
        }
      />
      {footer && <PaginationFooterSkeleton />}
    </div>
  );
}

/**
 * A vertical list placeholder — fixed-height rows in ONE bordered card, the shape the group member list
 * uses (`rounded-xl … ring-1 … divide-y`, rows `h-16`). Auto-fit is OPT-IN because not every list is
 * viewport-paginated.
 */
export function ListSkeleton({
  rows = 5,
  rowHeight = 64,
  auto = false,
  action = true,
  min,
  max,
}: {
  rows?: number;
  /** Row pitch in px — MUST match the real list row (`h-16` = 64). */
  rowHeight?: number;
  auto?: boolean;
  /** Trailing per-row control (the group member list's detail button). */
  action?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <FitList
      rowHeight={rowHeight}
      auto={auto}
      fallback={rows}
      min={min}
      max={max}
      className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10"
      item={
        <div data-skeleton-row className="flex items-center gap-2 px-4" style={{ height: rowHeight }}>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-3 w-56" />
          </div>
          {action && <Skeleton className="size-8 shrink-0 rounded-md" />}
        </div>
      }
    />
  );
}
