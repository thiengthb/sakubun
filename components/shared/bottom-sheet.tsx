'use client';

import { type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/**
 * The phone form of a control panel: it rises from the BOTTOM edge, stays anchored there, and closes
 * with a full-width button under the thumb.
 *
 * Why not the popover the same controls use on a desktop (2026-08-05, user report): a popover is
 * anchored to its trigger, and the triggers live in a toolbar at the TOP of the screen — so on a phone
 * the panel opened up there, 80vw wide, floating over the list with its controls furthest from the
 * thumb. It read as a modal dropped in the middle of the page. A bottom sheet puts the controls where
 * the hand already is, gives them the full width of the screen, and its direction of travel says what
 * it is: a layer over this page, dismissable downwards.
 *
 * Two callers share this shell so the filter sheet and the sort sheet are the SAME object on a phone:
 * `FilterPopover` (components/shared/filter-popover.tsx) and `SortSheet`
 * (components/shared/sort-sheet.tsx). Anything that belongs to "a panel of controls on a phone" —
 * the grab handle, the scrolling body, the safe-area padding, the closing button — belongs here, not
 * in either caller.
 *
 * `title` + `description` are BOTH required by Radix's dialog a11y contract (a content node without a
 * title logs a console error, which `e2e/mobile-layout.spec.ts` fails on). They are visible copy here
 * rather than sr-only text: a panel that slides over the page has to name itself.
 */
export function BottomSheet({
  trigger,
  title,
  description,
  headerAction,
  closeLabel = 'Xong',
  children,
  className,
}: {
  /** The control that opens the sheet — receives the trigger props directly (`asChild`). */
  trigger: ReactNode;
  title: ReactNode;
  /** One line saying what the panel does. Sits under the title. */
  description: ReactNode;
  /** Optional secondary action pinned to the title's right (e.g. "Đặt lại"). */
  headerAction?: ReactNode;
  /** Label of the full-width closing button. */
  closeLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="bottom"
        // The sheet's own close button (top-right X) is dropped: the closing affordance is the
        // full-width button in the footer, which is both larger and where the thumb already rests.
        showCloseButton={false}
        className={cn(
          // dvh, not vh: on mobile Safari/Chrome `vh` ignores the browser's own chrome, so a 85vh
          // sheet had its footer button UNDER the address bar — the one control it must never hide.
          'max-h-[85dvh] gap-0 rounded-t-2xl',
          className,
        )}
      >
        {/* Grab handle. Purely a signal of "this is a sheet, it came from down there" — the drag itself
            is not implemented (Radix Dialog has no drag), and a handle that only reads as an affordance
            is still worth its 4px: it is the mark every mobile OS uses for this layer. */}
        <div className="flex shrink-0 justify-center pt-2 pb-1">
          <span aria-hidden className="h-1 w-10 rounded-full bg-border" />
        </div>

        <SheetHeader className="shrink-0 gap-1 px-4 pt-1 pb-3">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-sm">{title}</SheetTitle>
            {headerAction}
          </div>
          <SheetDescription className="text-xs">{description}</SheetDescription>
        </SheetHeader>

        {/* min-h-0 is what lets this scroll inside a flex column — without it the body grows past the
            sheet's max-height and the footer button leaves the screen. */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-2">{children}</div>

        {/* pb keeps the button clear of the home-bar / gesture area on a notched phone. */}
        <SheetFooter className="shrink-0 border-t border-border/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <SheetClose asChild>
            <Button size="lg" className="w-full">
              {closeLabel}
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Touch-sized form controls inside a bottom sheet.
 *
 * The filter controls are authored once and rendered at BOTH widths (see `FilterPopover`), sized `sm`
 * (h-7 = 28px) for the desktop popover where they sit next to other 28px chrome. 28px is below every
 * platform's minimum touch target, so on the phone the sheet scales them up from the outside instead of
 * making every call site branch: one class list here, applied by whoever hosts sheet content.
 *
 * `!` is required, not sloppiness: the trigger's own `data-[size=sm]:h-7` has the SAME specificity as a
 * descendant selector, so without it which one wins depends on Tailwind's output order.
 */
export const SHEET_CONTROL_CLASS =
  '[&_[data-slot=select-trigger]]:h-10! [&_[data-slot=select-trigger]]:rounded-lg!';
