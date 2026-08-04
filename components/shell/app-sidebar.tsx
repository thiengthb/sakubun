'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ComponentType, type ReactNode } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';

/**
 * One navigation entry. `icon` is a lucide icon component (platform rule: icons = lucide only).
 * By default the item is active when the pathname starts with `href`; set `exact` for routes like
 * "/" that would otherwise match everything.
 */
export interface AppSidebarItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Match the pathname exactly instead of by prefix (use for the home "/" route). */
  exact?: boolean;
  /** Small count/label pinned to the right of the row (hidden when collapsed to the icon rail). */
  badge?: ReactNode;
  /** Render as a plain external anchor (new tab) instead of a client-side <Link>. */
  external?: boolean;
}

/** A titled cluster of items. Omit `label` for an untitled group. */
export interface AppSidebarGroup {
  label?: string;
  items: AppSidebarItem[];
}

export interface AppSidebarBrand {
  title: string;
  /** Where the brand links to (default "/"). */
  href?: string;
  /** A logo/glyph node shown left of the title (e.g. a lucide icon or a CJK mark). */
  logo?: ReactNode;
  subtitle?: string;
}

export interface AppSidebarProps {
  brand: AppSidebarBrand;
  /** Navigation, grouped. A single untitled group is the common case. */
  groups: AppSidebarGroup[];
  /** Footer slot — theme toggle, user chip, version, etc. */
  footer?: ReactNode;
  /**
   * Override active-route detection. Defaults to Next's `usePathname()`; pass this only to test
   * the component or drive it outside a Next router.
   */
  activePath?: string;
  className?: string;
}

function isActive(pathname: string, item: AppSidebarItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Config-driven application sidebar built on the shadcn `sidebar` primitive — collapses to an icon
 * rail on desktop (⌘/Ctrl+B) and to a Sheet on mobile, remembers its state via cookie, and shows
 * a tooltip per item when collapsed. Drop it inside a `<SidebarProvider>` next to a
 * `<SidebarInset>`; feed it a `brand` + `groups` config so every app wires the same component.
 *
 * NOTE — NEXT-ONLY: uses `next/link` + `next/navigation`. In a Vite SPA, swap those for react-router.
 */
export function AppSidebar({ brand, groups, footer, activePath, className }: AppSidebarProps) {
  const routerPathname = usePathname();
  const pathname = activePath ?? routerPathname;

  return (
    <Sidebar collapsible="icon" className={className}>
      <SidebarHeader>
        {/* Expanded: [logo + title ........ toggle] in a row. Collapsed: the logo stacks ABOVE the
            toggle (only the TEXT is hidden on the rail, so the brand mark stays visible). */}
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
          <Link
            href={brand.href ?? '/'}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full px-2 py-1.5 font-semibold group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:p-0"
          >
            {brand.logo && (
              <span className="flex size-6 shrink-0 items-center justify-center">{brand.logo}</span>
            )}
            <span className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
              {/* The wordmark is the one place the serif is doing pure brand work. */}
              <span className="truncate font-heading text-base leading-tight tracking-tight">
                {brand.title}
              </span>
              {brand.subtitle && (
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {brand.subtitle}
                </span>
              )}
            </span>
          </Link>
          {/* Collapse/expand toggle lives INSIDE the sidebar; stays visible on the icon rail. */}
          <SidebarTrigger className="group-data-[collapsible=icon]:mx-auto" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group, i) => (
          <SidebarGroup key={group.label ?? `group-${i}`}>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarMenu>
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      {item.external ? (
                        <a href={item.href} target="_blank" rel="noreferrer">
                          <Icon className="size-4" />
                          <span>{item.label}</span>
                        </a>
                      ) : (
                        <Link href={item.href} aria-current={active ? 'page' : undefined}>
                          <Icon className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                      )}
                    </SidebarMenuButton>
                    {item.badge != null && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {footer && (
        <SidebarFooter className="gap-2 group-data-[collapsible=icon]:items-center">
          {footer}
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  );
}
