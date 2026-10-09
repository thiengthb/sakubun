'use client';

import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Explain } from '@/components/shared/explain';
import type { AppSidebarGroup, AppSidebarItem } from '@/components/shell/app-sidebar';
import { cn } from '@/lib/utils';

function isActive(pathname: string, item: AppSidebarItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function EdgeNavRail({ groups }: { groups: AppSidebarGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = groups.flatMap((g) => g.items);

  return (
    <div
      onPointerEnter={(e: ReactPointerEvent) => {
        if (e.pointerType !== 'touch') setOpen(true); // touch uses the tap toggle below
      }}
      onPointerLeave={() => setOpen(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      className="fixed top-1/2 left-0 z-40 flex -translate-y-1/2 items-center md:hidden"
    >
      <AnimatePresence initial={false}>
        {open && (
          <motion.nav
            key="rail"
            aria-label="Điều hướng nhanh"
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex max-h-[calc(100vh-4rem)] flex-col items-center gap-1 overflow-y-auto rounded-r-2xl border border-l-0 border-border bg-background/95 p-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
          >
            {items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              const link = (
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                  onClick={() => setOpen(false)}
                  {...(item.external ? { target: '_blank', rel: 'noreferrer' } : null)}
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
                  )}
                >
                  <Icon className="size-4" />
                </Link>
              );
              return (
                <Explain key={item.href} text={item.label} side="right">
                  {link}
                </Explain>
              );
            })}
          </motion.nav>
        )}
      </AnimatePresence>

      <button
        type="button"
        aria-label={open ? 'Đóng thanh điều hướng' : 'Mở thanh điều hướng'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-24 w-3 items-center justify-center rounded-r-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span
          aria-hidden
          className={cn(
            'h-12 w-1 rounded-full bg-border transition-colors',
            open && 'bg-primary/60',
          )}
        />
      </button>
    </div>
  );
}
