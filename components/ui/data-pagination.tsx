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
import { cn } from '@/lib/utils';

interface DataPaginationProps {
  /** Current page, 1-based. */
  page: number;
  /** Total number of pages (>= 1). */
  pageCount: number;
  /** Called with the target page when the user navigates. */
  onPageChange: (page: number) => void;
  /** How many page numbers to show on each side of the current one (default 1). */
  siblingCount?: number;
  /** Disable every control (e.g. while the list is loading). */
  disabled?: boolean;
  className?: string;
  /** Current rows-per-page. Provide together with `onPageSizeChange` to show the size selector. */
  pageSize?: number;
  /** Options offered by the rows-per-page selector (default 25 / 50 / 100). */
  pageSizeOptions?: number[];
  /** Called with the new page size; when set (with `pageSize`) the size selector is shown. */
  onPageSizeChange?: (size: number) => void;
  /** Auto page-size is active (row count is fitted to the viewport). Shown as "Tự động (N)". */
  autoFit?: boolean;
  /** Re-enable auto page-size. When set, the selector offers a "Tự động" option. */
  onAutoFit?: () => void;
  /** The count auto-fit WOULD use — shown in the "Tự động (N)" label. Distinct from `pageSize`, which
   *  is the currently EFFECTIVE size (a fixed pick while auto is off); the label must always show the
   *  viewport fit, never the manual override. Falls back to `pageSize` when not supplied. */
  autoFitSize?: number;
}

const DOTS = '…';

function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
}

/**
 * Build a compact page window: [1, '…', 4, 5, 6, '…', 20]. Always keeps the first + last page
 * and `siblingCount` pages either side of the current one; fills gaps with a single ellipsis.
 */
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

/**
 * Shared controlled pagination control — the app owns the current page + slicing; this only renders
 * the navigation UI (and an optional rows-per-page selector). Works for client-side (slice in
 * memory) or server-side (drive a `?page=`/`?size=` param) paging. Reusable across every MiniServer
 * frontend. Renders nothing when there is a single page AND no size selector.
 */
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
}: DataPaginationProps) {
  // Must run before the early return below — hooks cannot be called conditionally.
  const sizeLabelId = useId();
  const showSize = pageSize != null && !!onPageSizeChange;
  if (pageCount <= 1 && !showSize) return null;

  const pages = buildPages(page, pageCount, siblingCount);
  const go = (target: number) => {
    const clamped = Math.min(Math.max(target, 1), pageCount);
    if (clamped !== page) onPageChange(clamped);
  };

  return (
    // flex-wrap: on a narrow screen the size selector + the page buttons wrap to a second line instead
    // of overflowing horizontally (which added a page scrollbar). The footer's real height is what the
    // viewport-fit math reserves, so wrapping simply leaves room for fewer rows.
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {showSize && (
        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
          {/* The caption is hidden below `sm`, but aria-labelledby still resolves its text, so the
              control keeps its name on small screens where the label is not painted. */}
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
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="min-w-[4.25rem]">
              {/* "Tự động (N)" — visible sign that the page size is fitted to the viewport, and the way
                  back to auto after ever picking a fixed size (otherwise auto stays off with no cue). */}
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
          className="flex flex-wrap items-center justify-center gap-1"
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
