'use client';

import { usePathname } from 'next/navigation';
import {
  BookOpenText,
  History,
  LayoutDashboard,
  Library,
  Settings,
} from 'lucide-react';
import { AppLogo } from '@/components/shell/app-logo';
import { AppSidebar, type AppSidebarGroup } from '@/components/shell/app-sidebar';
import { EdgeNavRail } from '@/components/shell/edge-nav-rail';
import { PublicTopBar } from '@/components/shell/public-top-bar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { StreakBeacon } from '@/components/dashboard/streak-beacon';
import { ThemeToggle } from '@/components/shell/theme-toggle';
import { SidebarUser } from '@/components/shell/sidebar-user';
import { useSession } from '@/lib/auth-client';

// Pre-auth routes render full-bleed (no sidebar/nav): the visitor is not signed in, so app
// navigation would only bounce back to /login. "/" is NEVER chromeless now — it is the dashboard,
// and a guest never reaches it (getSessionUserId redirects to /login).
const CHROMELESS = ['/login', '/register'];

/**
 * Routes a signed-OUT visitor may read. `/guide` is data-free, and staying readable before sign-in is
 * the point — but it must not get the app sidebar: every link in it would bounce to /login. It gets
 * the public top bar instead.
 */
const GUEST_VIEWABLE = ['/guide'];

const NAV_ITEMS = [
  { href: '/', label: 'Phân tích', icon: LayoutDashboard, exact: true },
  { href: '/resources', label: 'Tài nguyên', icon: Library },
  { href: '/history', label: 'Lịch sử', icon: History },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
  { href: '/guide', label: 'Hướng dẫn', icon: BookOpenText },
];

/** Owns page width + padding — pages render their content only (todo's shell invariant). */
export function AppShell({
  children,
  defaultSidebarOpen = true,
  authed = true,
}: {
  children: React.ReactNode;
  defaultSidebarOpen?: boolean;
  /** Server-resolved auth state — drives the guest landing at "/" (chromeless, no sidebar). */
  authed?: boolean;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const guestLanding = pathname === '/' && !authed;
  if (CHROMELESS.includes(pathname) || guestLanding) return <>{children}</>;

  if (!authed && GUEST_VIEWABLE.includes(pathname)) {
    return (
      <div className="flex min-h-dvh flex-col">
        <PublicTopBar containerClassName="max-w-7xl px-4 sm:px-6" />
        {/* Same width + padding as the signed-in <main>, so the page body is laid out identically. */}
        <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 sm:px-6">{children}</main>
      </div>
    );
  }

  // Single user: no roles, so no operator-only entries to append.
  const groups: AppSidebarGroup[] = [{ items: NAV_ITEMS }];

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <AppSidebar
        brand={{
          title: 'sakubun',
          subtitle: 'Luyện dịch Nhật–Việt',
          logo: <AppLogo />,
        }}
        groups={groups}
        footer={
          // Theme toggle sits ABOVE the identity card (avatar + name + email + a normal logout button).
          // SidebarFooter already stacks its children with a gap and centres them on the icon rail.
          <>
            <ThemeToggle />
            {session?.user && (
              <SidebarUser
                user={{
                  name: session.user.name,
                  email: session.user.email,
                  image: session.user.image,
                }}
              />
            )}
          </>
        }
      />
      {/* min-w-0: as a flex row item, SidebarInset must be allowed to shrink below its content's
          intrinsic width — otherwise a wide child (a table, a grid) forces the whole page wider than
          the viewport when the sidebar is open, adding both scrollbars ("phình" width + height). */}
      <SidebarInset className="min-w-0">
        {/* No top header — the sidebar owns its collapse + theme toggle. On mobile the sidebar is an
            off-canvas Sheet; the button to reopen it lives inline in each page's breadcrumb row
            (PageShell -> MobileTopBar), next to the app icon. */}
        {/* Wider container (max-w-7xl) so data-dense pages — history grid, resource tables — get more
            horizontal room and less wasted side margin (2026-07-18 request). */}
        <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 sm:px-6">{children}</main>
      </SidebarInset>
      {/* Small screens only (`md:hidden`, i.e. exactly when the sidebar became a Sheet and its trigger
          moved into the breadcrumb row): a left-edge grip that slides the SAME nav out as icons, so
          another page is one tap away instead of two. Fed the same `groups` config as the sidebar. */}
      <EdgeNavRail groups={groups} />
      {/* App-wide streak fire: fires on ANY page the moment the study-day streak grows (polls a cheap
          count; the once-per-increase guard lives in StreakCelebration). */}
      {session?.user && <StreakBeacon />}
    </SidebarProvider>
  );
}
