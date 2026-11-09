'use client';

import { usePathname } from 'next/navigation';
import {
  Globe,
  History,
  CircleUserRound,
  Layers,
  LayoutDashboard,
  Library,
  MessagesSquare,
  Settings,
} from 'lucide-react';
import { AppLogo } from '@/components/layout/app-logo';
import { AppSidebar, type AppSidebarGroup } from '@/components/layout/app-sidebar';
import { BottomNav, type BottomNavTab } from '@/components/layout/bottom-nav';
import { WordLookup } from '@/components/common/word-lookup';
import { ScrollToTop } from '@/components/layout/scroll-to-top';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { StreakBeacon } from '@/components/features/dashboard/streak-beacon';
import { SidebarUser } from '@/components/layout/sidebar-user';
import { useSession } from '@/lib/auth/auth-client';

// Auth pages: /login, and /consent where claude.ai or ChatGPT asks for access; and the public
// /privacy and /terms that Google's consent screen links to.
const CHROMELESS = ['/login', '/consent', '/privacy', '/terms'];

// UI v2 (docs/plans/2026-11-08-ui-v2.md › Bản đồ mới): three groups by what the learner does. Until
// the later phases land, Phân tích still holds / and Lịch sử its own page (phase 1 merges it into
// Tiến độ), and the two stores keep their own items (D6 makes them one "Kho" in phase 4).
const NAV_GROUPS: AppSidebarGroup[] = [
  {
    label: 'Học',
    items: [
      { href: '/', label: 'Phân tích', icon: LayoutDashboard, exact: true },
      { href: '/review', label: 'Ôn nhanh', icon: Layers },
      { href: '/kaiwa', label: 'Hội thoại', icon: MessagesSquare },
    ],
  },
  {
    label: 'Kho',
    items: [
      { href: '/resources', label: 'Tài nguyên', icon: Library },
      { href: '/library', label: 'Kho chung', icon: Globe },
    ],
  },
  {
    label: 'Bạn',
    items: [
      { href: '/history', label: 'Lịch sử', icon: History },
      { href: '/settings', label: 'Cài đặt', icon: Settings },
    ],
  },
];

export function AppShell({
  children,
  defaultSidebarOpen = true,
  furigana = null,
  due = 0,
}: {
  children: React.ReactNode;
  defaultSidebarOpen?: boolean;
  /** The learner's furigana setting, read by the root layout; null when nobody is signed in. */
  furigana?: boolean | null;
  /** Cards due now, for the Ôn nhanh tab (B2); read by the root layout. */
  due?: number;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  if (CHROMELESS.includes(pathname)) return <>{children}</>;

  const groups = NAV_GROUPS;

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <AppSidebar
        brand={{
          title: 'Sakubun',
          subtitle: 'Luyện dịch Nhật–Việt',
          logo: <AppLogo />,
        }}
        groups={groups}
        footer={
          session?.user ? (
            <SidebarUser
              user={{
                name: session.user.name,
                email: session.user.email,
                image: session.user.image,
              }}
              furigana={furigana}
            />
          ) : null
        }
      />
      <SidebarInset className="min-w-0">
        <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 pb-(--bottom-nav-space) sm:px-6">
          {children}
        </main>
      </SidebarInset>
      {session?.user && <BottomNav tabs={phoneTabs(pathname, due)} />}
      <ScrollToTop />
      {session?.user && <StreakBeacon />}
      {session?.user && <WordLookup />}
    </SidebarProvider>
  );
}

const under =
  (...roots: string[]) =>
  (pathname: string) =>
    roots.some((r) => pathname === r || pathname.startsWith(`${r}/`));

// The phone's five tabs (docs/plans/2026-11-08-ui-v2.md › Bản đồ mới). Kho holds both stores and
// Bạn the learner's own pages; until Hôm nay and Tiến độ exist, tab 1 is Phân tích and Bạn opens
// Lịch sử.
const PHONE_TABS = [
  { href: '/', label: 'Phân tích', icon: LayoutDashboard, match: (p: string) => p === '/' },
  { href: '/review', label: 'Ôn nhanh', icon: Layers, match: under('/review'), due: true },
  { href: '/kaiwa', label: 'Hội thoại', icon: MessagesSquare, match: under('/kaiwa') },
  { href: '/resources', label: 'Kho', icon: Library, match: under('/resources', '/library') },
  {
    href: '/history',
    label: 'Bạn',
    icon: CircleUserRound,
    match: under('/history', '/progress', '/settings', '/admin'),
  },
];

function phoneTabs(pathname: string, due: number): BottomNavTab[] {
  return PHONE_TABS.map(({ match, due: showsDue, ...tab }) => ({
    ...tab,
    active: match(pathname),
    ...(showsDue ? { badge: due, badgeLabel: (n: number) => `${n} thẻ đến hạn` } : {}),
  }));
}
