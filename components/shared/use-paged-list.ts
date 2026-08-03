'use client';

import { useCallback, type RefObject } from 'react';
import { useFitRows } from '@/components/ui/use-fit-rows';
import { useSessionState } from '@/components/shared/use-session-state';
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_OPTIONS } from '@/lib/pagination';

/**
 * Client-side pagination for a card LIST (history, community feed, groups) with the SAME viewport-fit
 * behaviour the `DataTable` gives its tables: the page size defaults to "fill the screen" (no page
 * scroll) and stays there until the user picks a fixed size, then respects it — with a "Tự động (N)"
 * option to return. The one place this logic lives, so every current and future paginated surface
 * behaves identically (the table has its own copy inlined because it is a ui-kit registry file).
 *
 * The caller owns the FILTERED array and the rendering; this owns page / size / auto-fit state (all
 * sessionStorage-scoped by `storeKey`, ephemeral — never mirrored to the URL) and hands back the
 * current page's slice plus the props to spread into `<DataPagination>`. Attach the returned refs:
 * `topRef` to the grid/list container, `footerRef` to the pagination bar row.
 */
export interface PagedList<T> {
  /** The current page's items. */
  items: T[];
  /** 1-based current page, clamped into range. */
  page: number;
  setPage: (page: number) => void;
  pageCount: number;
  /** Index of the first item on the page (for the "N–M / total" count line). */
  start: number;
  total: number;
  /** Effective rows per page (the auto-fit value while auto-fit is on, the manual pick otherwise). */
  pageSize: number;
  /** The count auto-fit WOULD use right now (the live viewport fit) — for the "Tự động (N)" label, so
   *  it shows the fit even while a fixed size is selected. Equals `pageSize` only while auto-fit is on. */
  autoFitSize: number;
  /** Options for the selector — includes the auto-fit value so "Tự động (N)" renders. */
  sizeOptions: number[];
  autoFit: boolean;
  choosePageSize: (size: number) => void;
  onAutoFit: () => void;
}

export function usePagedList<T>(
  all: T[],
  {
    topRef,
    footerRef,
    storeKey,
    rowHeight,
    rowGap = 12,
    grid = true,
    min,
    pageSizeOptions = [...PAGE_SIZE_OPTIONS],
  }: {
    topRef: RefObject<HTMLElement | null>;
    footerRef: RefObject<HTMLElement | null>;
    /** sessionStorage namespace, e.g. "history" / "community" / "groups". */
    storeKey: string;
    /** Fallback card pitch until the first card is measured (grids measure the real height). */
    rowHeight: number;
    /** Grid row-gap in px (default `gap-3` = 12). */
    rowGap?: number;
    grid?: boolean;
    min?: number;
    pageSizeOptions?: number[];
  },
): PagedList<T> {
  const fit = useFitRows({ topRef, footerRef, rowHeight, rowGap, grid, min });

  // Auto-fit is the default; it persists so "fill the screen" survives a reload.
  const [autoFit, setAutoFit] = useSessionState(`${storeKey}.autofit`, true);
  const [storedSize, setStoredSize] = useSessionState(`${storeKey}.size`, PAGE_SIZE_DEFAULT);
  const [page, setPageRaw] = useSessionState(`${storeKey}.page`, 1);

  // A size persisted before the options were unified is no longer offered — fall back to the default
  // so the selector never renders blank (same guard the history list had inline).
  const manualSize = pageSizeOptions.includes(storedSize) ? storedSize : PAGE_SIZE_DEFAULT;
  const pageSize = autoFit && fit != null ? fit : manualSize;
  // The live viewport fit, independent of the manual override — drives the "Tự động (N)" label so it
  // always shows the number auto-fit would pick (before first measure, fall back to the default).
  const autoFitSize = fit ?? PAGE_SIZE_DEFAULT;

  const total = all.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  const items = all.slice(start, start + pageSize);

  const sizeOptions = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

  const setPage = useCallback((p: number) => setPageRaw(p), [setPageRaw]);
  const choosePageSize = useCallback(
    (s: number) => {
      setAutoFit(false);
      setStoredSize(s);
      setPageRaw(1);
    },
    [setAutoFit, setStoredSize, setPageRaw],
  );
  const onAutoFit = useCallback(() => {
    setAutoFit(true);
    setPageRaw(1);
  }, [setAutoFit, setPageRaw]);

  return {
    items,
    page: safePage,
    setPage,
    pageCount,
    start,
    total,
    pageSize,
    autoFitSize,
    sizeOptions,
    autoFit,
    choosePageSize,
    onAutoFit,
  };
}
