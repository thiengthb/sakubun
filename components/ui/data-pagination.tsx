'use client';

import { useId } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/core/utils';

interface DataPaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  disabled?: boolean;
  className?: string;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  autoFit?: boolean;
  onAutoFit?: () => void;
  autoFitSize?: number;
  count?: React.ReactNode;
}

const DOTS = '…';

function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
}

function buildPages(
  page: number,
  pageCount: number,
  siblingCount: number,
): (number | typeof DOTS)[] {
  const totalNumbers = siblingCount * 2 + 5; // first + last + current + 2 siblings + 2 dots
  if (totalNumbers >= pageCount) return range(1, pageCount);

  const leftSibling = Math.max(page - siblingCount, 1);
  const rightSibling = Math.min(page + siblingCount, pageCount);
  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < pageCount - 1;
  const edgeCount = 3 + 2 * siblingCount;

  if (!showLeftDots && showRightDots) return [...range(1, edgeCount), DOTS, pageCount];
  if (showLeftDots && !showRightDots)
    return [1, DOTS, ...range(pageCount - edgeCount + 1, pageCount)];
  return [1, DOTS, ...range(leftSibling, rightSibling), DOTS, pageCount];
}

export function DataPagination({
  page,
  pageCount,
  onPageChange,
  siblingCount = 1,
  disabled = false,
  className,
  pageSize,
  pageSizeOptions = [25, 50, 100],
  onPageSizeChange,
  autoFit = false,
  onAutoFit,
  autoFitSize,
  count,
}: DataPaginationProps) {
  const sizeLabelId = useId();
  const showSize = pageSize != null && !!onPageSizeChange;
  if (pageCount <= 1 && !showSize && !count) return null;

  const pages = buildPages(page, pageCount, siblingCount);
  const go = (target: number) => {
    const clamped = Math.min(Math.max(target, 1), pageCount);
    if (clamped !== page) onPageChange(clamped);
  };

  return (
    <div className={cn('flex w-full flex-wrap items-center gap-x-3 gap-y-2', className)}>
      {count != null && (
        <span className="order-2 mr-auto text-xs text-muted-foreground sm:order-1">{count}</span>
      )}
      {showSize && (
        <div className="order-3 flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground sm:order-2">
          <span id={sizeLabelId} className="hidden sm:inline">
            Số dòng
          </span>
          <Select
            value={autoFit ? 'auto' : String(pageSize)}
            onValueChange={(v) => (v === 'auto' ? onAutoFit?.() : onPageSizeChange?.(Number(v)))}
            disabled={disabled}
          >
            <SelectTrigger
              size="sm"
              className="h-7 w-auto min-w-[4.25rem]"
              aria-labelledby={sizeLabelId}
            >
              <SelectValue>
                {autoFit ? `Tự động (${autoFitSize ?? pageSize})` : String(pageSize)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" className="min-w-[4.25rem]">
              {onAutoFit && (
                <SelectItem value="auto">Tự động ({autoFitSize ?? pageSize})</SelectItem>
              )}
              {pageSizeOptions.map((o) => (
                <SelectItem key={o} value={String(o)}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {pageCount > 1 && (
        <nav
          role="navigation"
          aria-label="Phân trang"
          className="order-1 flex w-full flex-wrap items-center justify-center gap-1 sm:order-3 sm:w-auto"
        >
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => go(page - 1)}
            disabled={disabled || page <= 1}
            aria-label="Trang trước"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>

          {pages.map((p, i) =>
            p === DOTS ? (
              <span
                key={`dots-${i}`}
                className="flex size-8 items-center justify-center text-muted-foreground"
                aria-hidden
              >
                <MoreHorizontal className="size-4" />
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? 'default' : 'ghost'}
                size="icon"
                className="size-8"
                onClick={() => go(p)}
                disabled={disabled}
                aria-label={`Trang ${p}`}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </Button>
            ),
          )}

          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => go(page + 1)}
            disabled={disabled || page >= pageCount}
            aria-label="Trang sau"
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </nav>
      )}
    </div>
  );
}
