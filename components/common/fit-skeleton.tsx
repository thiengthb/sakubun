'use client';

import { Fragment, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/core/utils';
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

export function TableSkeleton({
  rows = 8,
  rowHeight = 49,
  cardHeight = 110,
  auto = true,
  footer = true,
  min,
  max,
}: {
  rows?: number;
  rowHeight?: number;
  cardHeight?: number;
  auto?: boolean;
  footer?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-3">
      <FitList
        rowHeight={cardHeight}
        rowGap={8}
        auto={auto}
        fallback={Math.min(rows, 5)}
        min={min}
        max={max}
        className="flex flex-col gap-2 lg:hidden"
        item={RESOURCE_CARD}
      />
      <div className="space-y-2 rounded-lg border p-4 max-lg:hidden">
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
      {/* Below 1024px the cards load more as they scroll: no pagination. */}
      {footer && (
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
  rowHeight?: number;
  columns?: string;
  rowGap?: number;
  auto?: boolean;
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
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="ml-auto h-4 w-14" />
              <Skeleton className="size-6 shrink-0 rounded-md" />
            </div>
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
