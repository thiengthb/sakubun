'use client';

import { type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BottomSheet, SHEET_CONTROL_CLASS } from '@/components/shared/bottom-sheet';
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import { useIsMobile } from '@/hooks/use-mobile';
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

/** The "Đặt lại" link in the panel header — one shape for both the popover and the sheet. */
function ResetLink({ onReset }: { onReset: () => void }) {
  return (
    <button
      type="button"
      onClick={onReset}
      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      Đặt lại
    </button>
  );
}

/**
 * Shared "Bộ lọc" panel: an expanding filter-icon button (with an active-filter count badge) that opens
 * the caller's filter controls, plus a reset affordance. The caller owns the filter state and renders
 * `FilterRow`s as children. One pattern for every data view (history + resource tables + groups).
 *
 * TWO FORMS, ONE API (2026-08-05) — a POPOVER from `md` up, a BOTTOM SHEET below it:
 *
 *   - Desktop: a 320px popover anchored under the trigger, two columns of controls. It sits next to the
 *     toolbar it belongs to and leaves the list visible beside it.
 *   - Phone: `BottomSheet`. The popover was anchored to a trigger in the TOP toolbar, so on a phone it
 *     opened up there — 80vw of floating panel over the list, its controls as far from the thumb as the
 *     screen allows, reading as a modal dropped mid-page (user report). The sheet rises from the bottom
 *     edge, takes the full width, and every select is a 40px touch target (`SHEET_CONTROL_CLASS`).
 *
 * The form is chosen in JS (`useIsMobile`), not with `max-md:hidden` on two copies: both Radix panels
 * portal to `document.body`, and mounting the children twice would give every filter control a hidden
 * twin — two `<Select>`s with one `value`, and a duplicate DOM node for every e2e locator.
 *
 * MOBILE: the standalone "Xóa lọc" button is DESKTOP-ONLY, and the active count becomes a
 * notification-style dot pinned to the trigger's top-right corner instead of a chip inside it.
 *
 * Clearing did not need two entry points on a 360px row — the panel already has "Đặt lại", and you
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
  const isMobile = useIsMobile();

  const trigger = (
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
  );

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
        {isMobile ? (
          <BottomSheet
            trigger={trigger}
            title="Bộ lọc"
            description={
              activeCount > 0
                ? `Đang lọc theo ${activeCount} điều kiện.`
                : 'Chọn điều kiện để thu hẹp danh sách.'
            }
            headerAction={activeCount > 0 && onReset ? <ResetLink onReset={onReset} /> : undefined}
            closeLabel="Xem kết quả"
            // One column: two selects side by side on a 390px screen wrap every label onto two lines.
            className={SHEET_CONTROL_CLASS}
          >
            {/* The caller's `FilterRow`s verbatim, stacked instead of gridded. A caller's
                `col-span-2` wrapper (the history score slider) is simply inert outside a grid. */}
            <div className="space-y-4">{children}</div>
          </BottomSheet>
        ) : (
          <Popover>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent align={align} className="max-h-[70vh] w-80 gap-3 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Bộ lọc</span>
                {activeCount > 0 && onReset && <ResetLink onReset={onReset} />}
              </div>
              <div className="grid grid-cols-2 gap-3">{children}</div>
            </PopoverContent>
          </Popover>
        )}

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
