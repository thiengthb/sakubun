'use client';

import { Fragment, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/core/utils';
import { LIST_CARD } from '@/components/common/list-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFitRows } from '@/components/ui/use-fit-rows';
import { useSessionState } from '@/components/common/use-session-state';

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
  rowHeight: number;
  rowGap?: number;
  grid?: boolean;
  auto?: boolean;
  fallback: number;
  min?: number;
  max?: number;
  className?: string;
  item: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fit = useFitRows({ topRef: ref, rowHeight, rowGap, grid, min, max });
  const count = auto ? (fit ?? fallback) : fallback;
  return (
    <div ref={ref} className={className}>
      {Array.from({ length: count }, (_, i) => (
        <Fragment key={i}>{item}</Fragment>
      ))}
    </div>
  );
}

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

function PaginationFooterSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Skeleton className="h-4 w-40" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-8 w-44 rounded-md" />
      </div>
    </div>
  );
}

// The grammar and vocab card (ResourceCard) as grey shapes of the same size: the level chip across
// both lines, the title, the meaning, and the menu over the star.
const RESOURCE_CARD_HEIGHT = 94;
const RESOURCE_CARD = (
  <div
    data-skeleton-row
    className={cn(
      LIST_CARD.base,
      'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5',
    )}
  >
    <Skeleton className="row-span-2 h-5 w-8 rounded-sm" />
    <Skeleton className="h-4 w-2/5" />
    <Skeleton className="size-9 rounded-md md:size-7" />
    <Skeleton className="h-3.5 w-3/4" />
    <Skeleton className="size-7 rounded-md" />
  </div>
);

/** The card list a DataTable draws: the same columns and gaps. */
function ResourceCardsSkeleton({
  auto,
  fallback,
  min,
  max,
  className,
}: {
  auto: boolean;
  fallback: number;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <div className={cn('@container', className)}>
      <FitList
        rowHeight={RESOURCE_CARD_HEIGHT}
        rowGap={14}
        grid
        auto={auto}
        fallback={fallback}
        min={min}
        max={max}
        className="grid gap-x-2 gap-y-3.5 @2xl:grid-cols-2 @2xl:gap-x-3 @5xl:grid-cols-3"
        item={RESOURCE_CARD}
      />
    </div>
  );
}

const TABLE_ROW = (
  <div data-skeleton-row className="flex h-12 items-center gap-3">
    <Skeleton className="size-6 shrink-0 rounded-full" />
    <Skeleton className="h-4 min-w-0 flex-[3]" />
    <Skeleton className="hidden h-4 min-w-0 flex-[2] sm:block" />
    <Skeleton className="hidden h-4 w-16 md:block" />
    <Skeleton className="hidden h-4 w-16 lg:block" />
    <div className="ml-auto flex shrink-0 items-center gap-1.5">
      <Skeleton className="size-7 rounded-md" />
      <Skeleton className="size-7 rounded-md" />
      <Skeleton className="size-7 rounded-md" />
    </div>
  </div>
);

interface TableSkeletonProps {
  rows?: number;
  rowHeight?: number;
  auto?: boolean;
  footer?: boolean;
  min?: number;
  max?: number;
  /**
   * Where the DataTable keeps its view switch (`${persistKey}.view`, `${urlPrefix}view`): when the
   * learner chose cards, the wide layout waits as cards too, not as a table.
   */
  view?: { storeKey: string; urlKey: string };
}

export function TableSkeleton({ view, ...props }: TableSkeletonProps) {
  return view ? <ViewTableSkeleton view={view} {...props} /> : <Table {...props} cards={false} />;
}

function ViewTableSkeleton({
  view,
  ...props
}: Omit<TableSkeletonProps, 'view'> & { view: { storeKey: string; urlKey: string } }) {
  const [chosen] = useSessionState<string>(view.storeKey, 'table', view.urlKey);
  return <Table {...props} cards={chosen === 'cards'} />;
}

function Table({
  rows = 8,
  rowHeight = 49,
  auto = true,
  footer = true,
  min,
  max,
  cards,
}: Omit<TableSkeletonProps, 'view'> & { cards: boolean }) {
  return (
    <div className="space-y-3">
      <ResourceCardsSkeleton
        auto={auto}
        fallback={Math.min(rows, 5)}
        min={min}
        max={max}
        className={cn(!cards && 'lg:hidden')}
      />
      <div className={cn('space-y-2 rounded-lg border p-4 max-lg:hidden', cards && 'lg:hidden')}>
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
      {/* The cards load more as they scroll: no pagination. */}
      {footer && !cards && (
        <div className="max-lg:hidden">
          <PaginationFooterSkeleton />
        </div>
      )}
    </div>
  );
}

export function CardsSkeleton({
  count = 6,
  rowHeight = 86,
  columns = '@2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3',
  rowGap = 8,
  footer = true,
  min,
  max,
}: {
  count?: number;
  rowHeight?: number;
  columns?: string;
  rowGap?: number;
  /** 'lg': pages from 1024px only, below it the cards load as they scroll (Lịch sử). */
  footer?: boolean | 'lg';
  min?: number;
  max?: number;
}) {
  return (
    <div className="@container space-y-3">
      <FitList
        rowHeight={rowHeight}
        rowGap={rowGap}
        grid
        fallback={count}
        min={min}
        max={max}
        className={cn('grid gap-2', columns)}
        item={
          <div
            data-skeleton-row
            className={cn(LIST_CARD.base, 'flex flex-col gap-1.5')}
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
      {footer && (
        <div className={cn(footer === 'lg' && 'max-lg:hidden')}>
          <PaginationFooterSkeleton />
        </div>
      )}
    </div>
  );
}

export function ListSkeleton({
  rows = 5,
  rowHeight = 64,
  auto = false,
  action = true,
  min,
  max,
}: {
  rows?: number;
  rowHeight?: number;
  auto?: boolean;
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
        <div
          data-skeleton-row
          className="flex items-center gap-2 px-4"
          style={{ height: rowHeight }}
        >
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
