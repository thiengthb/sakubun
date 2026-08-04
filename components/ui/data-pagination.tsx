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
  /** The "1–10 / 42 mẫu" summary. Passed IN (rather than rendered by the caller beside this component)
   *  so all three footer pieces are siblings in one flex container and can be re-ordered per
   *  breakpoint — see the layout note on the returned element. */
  count?: React.ReactNode;
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
  count,
}: DataPaginationProps) {
  // Must run before the early return below — hooks cannot be called conditionally.
  const sizeLabelId = useId();
  const showSize = pageSize != null && !!onPageSizeChange;
  if (pageCount <= 1 && !showSize && !count) return null;

  const pages = buildPages(page, pageCount, siblingCount);
  const go = (target: number) => {
    const clamped = Math.min(Math.max(target, 1), pageCount);
    if (clamped !== page) onPageChange(clamped);
  };

  return (
    /* THE FOOTER LAYOUT, and why it is one flex container with explicit `order`s.
     *
     * Phone (< sm) — two rows:
     *     [        ‹ 1 2 3 ›  centred        ]   <- nav, order-1, w-full
     *     [ 1–10 / 42 mẫu            25 ▾ ]      <- count (order-2, mr-auto) + size (order-3)
     *
     * sm and up — one row:
     *     [ 1–10 / 42 mẫu       25 ▾   ‹ 1 2 3 › ]
     *
     * The nav takes the phone's top row because it is the control you actually press, and centred it is
     * reachable with either thumb; the count and the size picker are a status line and a rarely-touched
     * setting, so they share the row below. `mr-auto` on the count does the pushing at BOTH breakpoints
     * (it separates count from size on the phone's second row, and count from the pair on desktop), so
     * there is no second alignment rule to keep in sync.
     */
    <div className={cn('flex w-full flex-wrap items-center gap-x-3 gap-y-2', className)}>
      {count != null && (
        <span className="order-2 mr-auto text-xs text-muted-foreground sm:order-1">{count}</span>
      )}
      {showSize && (
        <div className="order-3 flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground sm:order-2">
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
