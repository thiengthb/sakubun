'use client';

import { useCallback, type RefObject } from 'react';
import { useFitRows } from '@/components/ui/use-fit-rows';
import { useSessionState } from '@/components/shared/use-session-state';
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_OPTIONS } from '@/lib/pagination';

export interface PagedList<T> {
  items: T[];
  page: number;
  setPage: (page: number) => void;
  pageCount: number;
  start: number;
  total: number;
  pageSize: number;
  autoFitSize: number;
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
    storeKey: string;
    rowHeight: number;
    rowGap?: number;
    grid?: boolean;
    min?: number;
    pageSizeOptions?: number[];
  },
): PagedList<T> {
  const fit = useFitRows({ topRef, footerRef, rowHeight, rowGap, grid, min });

  const [autoFit, setAutoFit] = useSessionState(`${storeKey}.autofit`, true);
  const [storedSize, setStoredSize] = useSessionState(`${storeKey}.size`, PAGE_SIZE_DEFAULT);
  const [page, setPageRaw] = useSessionState(`${storeKey}.page`, 1);

  const manualSize = pageSizeOptions.includes(storedSize) ? storedSize : PAGE_SIZE_DEFAULT;
  const pageSize = autoFit && fit != null ? fit : manualSize;
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
