'use client';

import { Separator } from '@/components/ui/separator';
import { useOptionalSidebar } from '@/components/ui/sidebar';
import { AppLogo } from '@/components/shell/app-logo';

/**
 * Shown ONLY when the sidebar has collapsed to its off-canvas (mobile) form (`md:hidden`) — there the
 * sidebar's brand + toggle are hidden, so the page needs its own. Rendered at the START of every page's
 * breadcrumb row (via PageShell), followed by a divider that separates it from the breadcrumb.
 *
 * THE LOGO IS THE TOGGLE (2026-08-04). It used to be a decorative mark with a separate hamburger next
 * to it — two controls' worth of width for one action, on the axis where width is scarcest. The mark is
 * already the biggest tap target in the row and already reads as "the app", so it carries the action.
 *
 * On a page with NO sidebar (a signed-out visitor on a `GUEST_VIEWABLE` route gets the public top bar
 * instead of the provider — see shell/app-shell.tsx) the logo stays a plain mark: a button that opens
 * nothing is worse than no button.
 */
export function MobileTopBar() {
  const sidebar = useOptionalSidebar();

  return (
    <div className="flex items-center gap-2 md:hidden">
      {sidebar ? (
        <button
          type="button"
          onClick={sidebar.toggleSidebar}
          // aria-label, not a title: on touch there is no hover to reveal a tooltip, and the icon is
          // decorative (aria-hidden inside AppLogo), so without this the control has no name at all.
          aria-label="Mở menu"
          aria-expanded={sidebar.openMobile}
          // No aria-controls: the off-canvas sidebar is a Sheet that only exists in the DOM while open,
          // so the id would dangle most of the time — a broken reference reads worse than none.
          // -m + p keeps the visual size identical while giving the tap target ~40px (Apple/Material
          // both floor at 44/48; the row is 32px tall, so the padding is what makes it thumb-safe).
          className="-m-1.5 flex cursor-pointer items-center rounded-md p-1.5 transition-colors hover:bg-muted active:bg-muted"
        >
          <AppLogo />
        </button>
      ) : (
        <AppLogo />
      )}
      <Separator orientation="vertical" className="h-5" />
    </div>
  );
}
