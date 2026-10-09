'use client';

import { usePathname } from 'next/navigation';
import { History, LayoutDashboard, Library, Settings } from 'lucide-react';
import { AppLogo } from '@/components/shell/app-logo';
import { AppSidebar, type AppSidebarGroup } from '@/components/shell/app-sidebar';
import { EdgeNavRail } from '@/components/shell/edge-nav-rail';
import { ScrollToTop } from '@/components/shell/scroll-to-top';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { StreakBeacon } from '@/components/dashboard/streak-beacon';
import { ThemeToggle } from '@/components/shell/theme-toggle';
import { SidebarUser } from '@/components/shell/sidebar-user';
import { useSession } from '@/lib/auth-client';

const CHROMELESS = ['/login', '/register'];

const NAV_ITEMS = [
  { href: '/', label: 'Phân tích', icon: LayoutDashboard, exact: true },
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
          title: 'sakubun',
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
