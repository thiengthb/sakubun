'use client';

import Link from 'next/link';
import { cn } from '@/lib/core/utils';

// The phone has five tabs and no other menu (thien, U1 gate), so a tab that holds two pages shows a
// switch between them at the top: Kho holds Của bạn and Kho chung, Bạn holds Tiến độ, Phân tích and Cài đặt.
// Only on the two pages themselves; a laptop reaches both from the sidebar.
const SECTIONS = [
  [
    { href: '/resources', label: 'Của bạn' },
    { href: '/library', label: 'Kho chung' },
  ],
  [
    { href: '/progress', label: 'Tiến độ' },
    { href: '/analytics', label: 'Phân tích' },
    { href: '/settings', label: 'Cài đặt' },
  ],
] as const;

export function SectionSwitch({ pathname }: { pathname: string }) {
  const section = SECTIONS.find((pages) => pages.some((p) => p.href === pathname));
  if (!section) return null;
  return (
    <nav aria-label="Chuyển trang" className="flex gap-2 pt-4 md:hidden">
      {section.map((page) => {
        const here = page.href === pathname;
        return (
          <Link
            key={page.href}
            href={page.href}
            aria-current={here ? 'page' : undefined}
            className={cn(
              'target-44 mb-0.5 flex h-8.5 flex-1 items-center justify-center rounded-sm border-2 border-control-edge bg-card text-sm font-medium text-muted-foreground shadow-lift outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-0.5 active:shadow-none',
              here && 'border-brand-wash bg-brand-wash text-accent-brand shadow-lift-chosen',
            )}
          >
            {page.label}
          </Link>
        );
      })}
    </nav>
  );
}
