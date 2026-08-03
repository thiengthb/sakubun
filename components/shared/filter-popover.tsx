'use client';

import { type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import { cn } from '@/lib/utils';

/** A labelled control inside a filter popover (shared by /history + /resources tables). */
export function FilterRow({
  label,
  className,
  children,
}: {
  label: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Shared "Bộ lọc" popover: an expanding filter-icon button (with an active-filter count badge) that
 * opens a 2-column grid of filter controls, plus a reset affordance. The caller owns the filter state
 * and renders `FilterRow`s as children. One pattern for every data view (history + resource tables).
 *
 * MOBILE (2026-08-04): the standalone "Xóa lọc" button is DESKTOP-ONLY, and the active count becomes a
 * notification-style dot pinned to the trigger's top-right corner instead of a chip inside it.
 *
 * Clearing did not need two entry points on a 360px row — the popover already has "Đặt lại", and you
 * cannot want to clear a filter without first opening the thing that shows you what is filtered. The
 * button cost ~80px next to the search box to save one tap.
 *
 * The count moves OUT of the button because a chip inside it widened the control every time a filter
 * turned on, shifting the toolbar sideways mid-interaction. Overlaid, the button's width is constant
 * and the badge reads the way every other unread-count in the app does.
 */
export function FilterPopover({
  activeCount,
  onReset,
  align = 'start',
  children,
}: {
  activeCount: number;
  onReset?: () => void;
  align?: 'start' | 'center' | 'end';
  children: ReactNode;
}) {
  return (
    <>
      {activeCount > 0 && onReset && (
        // `default` size (h-8) so it lines up with the search box + the other toolbar buttons.
        <Button variant="ghost" onClick={onReset} className="max-md:hidden">
          <X className="size-4" aria-hidden />
          Xóa lọc
        </Button>
      )}
      {/* relative wrapper, not the button itself: the badge is absolutely positioned against it, and
          putting `relative` on the trigger would fight Radix's own styles on some variants. */}
      <div className="relative shrink-0">
        <Popover>
          <PopoverTrigger asChild>
            <ExpandingIconButton
              icon={SlidersHorizontal}
              label={activeCount > 0 ? `Bộ lọc (${activeCount} đang bật)` : 'Bộ lọc'}
              badge={
                activeCount > 0 ? (
                  <Badge
                    className="h-4 min-w-4 justify-center px-1 text-xs tabular-nums max-md:hidden"
                    variant="secondary"
                  >
                    {activeCount}
                  </Badge>
                ) : null
              }
            />
          </PopoverTrigger>
          <PopoverContent align={align} className="max-h-[70vh] w-80 gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Bộ lọc</span>
              {activeCount > 0 && onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Đặt lại
                </button>
              )}
            </div>
            {/* One column below sm: two 140px-wide selects side by side inside an 80vw popover left
                each label wrapping onto two lines. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
          </PopoverContent>
        </Popover>

        {/* Mobile-only count, overlaid on the trigger's top-right corner like an unread badge. Uses the
            theme's primary so "something is filtering this list" is the same colour as every other
            active/accent state. aria-hidden: the count is already in the trigger's aria-label, and a
            bare number announced after it would read as noise. */}
        {activeCount > 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-xs leading-none font-semibold text-primary-foreground tabular-nums ring-2 ring-background md:hidden"
          >
            {activeCount}
          </span>
        )}
      </div>
    </>
  );
}
