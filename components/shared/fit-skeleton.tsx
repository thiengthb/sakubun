'use client';

import { Fragment, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useFitRows } from '@/components/ui/use-fit-rows';

// Auto-fitting skeletons — the loading-state twin of the viewport-fit pagination (`useFitRows` +
// pure math `lib/fit-rows.ts`). A route's `loading.tsx` renders as many placeholder rows/cards as
// will ACTUALLY fit the viewport — the SAME count the real list computes — so the skeleton fills the
// screen and the hand-off to real data doesn't jump (a short 8-row skeleton popping to 16 real rows,
// or an 8-row skeleton overflowing a laptop viewport, were the two drifts this fixes).
//
// Two contracts:
//   1. FIT — keep each placeholder item's height equal to the real row/card (table row = `h-12` 48px;
//      a history card = 120px; a group member row = 64px). `useFitRows` derives the pitch from the
//      measured DOM, so a same-height placeholder fits the same number. Fixed-height items make the
//      pitch exact → the count converges in one step (no oscillation the deadband must damp).
//   2. SHAPE — mirror the real ROW, not a single gray bar: the same columns (a table row is a play
//      glyph + expression + meaning + state/due + an action cluster), the same header strip, and the
//      pagination footer the real table always renders. A skeleton that structurally matches the
//      page it stands in for doesn't re-flow when data arrives.
//
// Before the first measure (and during SSR) the hook returns null → we render `fallback` items; the
// client measurement corrects within a frame. Set `auto={false}` for a surface that is NOT
// viewport-fitted (e.g. the admin member list) to keep a fixed count.

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

/**
 * A data-table placeholder that mirrors the real table: a column header strip, viewport-fitted `h-12`
 * rows each shaped like a real row (audio glyph + expression + meaning + state/due + an action
 * cluster), and the pagination footer. The columns collapse at the same-ish breakpoints the real
 * table sheds them, so the skeleton reads as the table at every width.
 */
export function TableSkeleton({
  rows = 8,
  rowHeight = 48,
  auto = true,
  footer = true,
  min,
  max,
}: {
  /** Fallback row count (server / pre-measure; or the fixed count when `auto` is off). */
  rows?: number;
  /** Row pitch in px — MUST match the real table row (`h-12` = 48). */
  rowHeight?: number;
  auto?: boolean;
  /** Render the pagination footer below the table (the real DataTable always does). */
  footer?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
        {/* Column header strip (mirrors <thead>): short header labels over the same columns. */}
        <div className="flex items-center gap-3 border-b pb-2">
          <div className="size-6 shrink-0" />
          <Skeleton className="h-3 w-24 flex-[3]" style={{ maxWidth: 100 }} />
          <Skeleton className="hidden h-3 flex-[2] sm:block" style={{ maxWidth: 80 }} />
          <Skeleton className="hidden h-3 w-12 md:block" />
          <Skeleton className="hidden h-3 w-12 lg:block" />
          <div className="ml-auto w-[168px] shrink-0" />
        </div>
        <FitList
          rowHeight={rowHeight}
          auto={auto}
          fallback={rows}
          min={min}
          max={max}
          className="divide-y"
          item={
            <div className="flex h-12 items-center gap-3">
              {/* expression cell: the SpokenLine play glyph + the term text. */}
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <Skeleton className="h-4 min-w-0 flex-[3]" />
              {/* meaning */}
              <Skeleton className="hidden h-4 min-w-0 flex-[2] sm:block" />
              {/* state / due */}
              <Skeleton className="hidden h-4 w-16 md:block" />
              <Skeleton className="hidden h-4 w-16 lg:block" />
              {/* actions: star · quick-look · share pill · ⋮ menu. */}
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <Skeleton className="size-7 rounded-md" />
                <Skeleton className="size-7 rounded-md" />
                <Skeleton className="h-7 w-16 rounded-md" />
                <Skeleton className="size-7 rounded-md" />
              </div>
            </div>
          }
        />
      </div>
      {footer && <PaginationFooterSkeleton />}
    </div>
  );
}

/**
 * A responsive card-grid placeholder — viewport-fitted tiles on the same column ramp the real card
 * lists use, each tile shaped like the real card (a header row of badges + score + time + star, then
 * a play-line body). `rowHeight` is the real card pitch (history/community = 120) and the tile
 * height, so the measured fit matches. `grid` lets the hook read the live column count.
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
          <div className="flex flex-col gap-3 rounded-xl border p-4" style={{ height: rowHeight }}>
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
 * A vertical list placeholder (divide-y rows in a bordered box) — the member/roster lists. Auto-fit
 * is OPT-IN (`auto`) because not every list is viewport-paginated: the admin member list is a fixed
 * short roster, while a group's member list IS viewport-fitted, so only the latter passes `auto`.
 */
export function ListSkeleton({
  rows = 5,
  rowHeight = 64,
  auto = false,
  min,
  max,
}: {
  rows?: number;
  /** Row pitch in px — MUST match the real list row. */
  rowHeight?: number;
  auto?: boolean;
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
      className="divide-y rounded-2xl border border-border/70 bg-card shadow-soft"
      item={
        <div className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      }
    />
  );
}
