'use client';

import { usePathname } from 'next/navigation';
import { History, Layers, LayoutDashboard, Library, Settings } from 'lucide-react';
import { AppLogo } from '@/components/layout/app-logo';
import { AppSidebar, type AppSidebarGroup } from '@/components/layout/app-sidebar';
import { EdgeNavRail } from '@/components/layout/edge-nav-rail';
import { ScrollToTop } from '@/components/layout/scroll-to-top';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { StreakBeacon } from '@/components/features/dashboard/streak-beacon';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { SidebarUser } from '@/components/layout/sidebar-user';
import { useSession } from '@/lib/auth/auth-client';

// Auth pages: /login, and /consent where claude.ai or ChatGPT asks for access; and the public
// /privacy and /terms that Google's consent screen links to.
const CHROMELESS = ['/login', '/consent', '/privacy', '/terms'];

const NAV_ITEMS = [
  { href: '/', label: 'Phân tích', icon: LayoutDashboard, exact: true },
  { href: '/review', label: 'Ôn nhanh', icon: Layers },
  { href: '/resources', label: 'Tài nguyên', icon: Library },
  { href: '/history', label: 'Lịch sử', icon: History },
  { href: '/settings', label: 'Cài đặt', icon: Settings },
];

export function AppShell({
  children,
  defaultSidebarOpen = true,
}: {
  children: React.ReactNode;
  defaultSidebarOpen?: boolean;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  if (CHROMELESS.includes(pathname)) return <>{children}</>;

  const groups: AppSidebarGroup[] = [{ items: NAV_ITEMS }];

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
      <SidebarInset className="min-w-0">
        <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 sm:px-6">{children}</main>
      </SidebarInset>
      <EdgeNavRail groups={groups} />
      <ScrollToTop />
      {session?.user && <StreakBeacon />}
    </SidebarProvider>
  );
}
