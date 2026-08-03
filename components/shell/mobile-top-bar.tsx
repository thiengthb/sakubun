'use client';

import { Separator } from '@/components/ui/separator';
import { SidebarTrigger, useOptionalSidebar } from '@/components/ui/sidebar';
import { AppLogo } from '@/components/shell/app-logo';

/**
 * Shown ONLY when the sidebar has collapsed to its off-canvas (mobile) form (`md:hidden`) — there the
 * sidebar's brand + toggle are hidden, so the page needs its own. Rendered at the START of every page's
 * breadcrumb row (via PageShell): the app icon, then the button that opens the sidebar, then a divider
 * separating this control cluster from the breadcrumb. On md+ it renders nothing (the sidebar owns it).
 *
 * The toggle is CONDITIONAL because PageShell also renders on pages that have no sidebar at all: a
 * signed-out visitor reading a `GUEST_VIEWABLE` route (`shell/app-shell.tsx`) gets the public top bar
 * instead of the provider. Asking `useOptionalSidebar` keeps the guest page alive AND keeps a dead
 * button off it — a trigger with nothing to open is worse than no trigger.
 */
export function MobileTopBar() {
  const sidebar = useOptionalSidebar();
  return (
    <div className="flex items-center gap-2 md:hidden">
      <AppLogo />
      {sidebar && <SidebarTrigger className="-ml-0.5" />}
      <Separator orientation="vertical" className="h-5" />
    </div>
  );
}
