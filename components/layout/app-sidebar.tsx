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

export interface AppSidebarItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  badge?: ReactNode;
  external?: boolean;
}

export interface AppSidebarGroup {
  label?: string;
  items: AppSidebarItem[];
}

export interface AppSidebarBrand {
  title: string;
  href?: string;
  logo?: ReactNode;
  subtitle?: string;
}

export interface AppSidebarProps {
  brand: AppSidebarBrand;
  groups: AppSidebarGroup[];
  footer?: ReactNode;
  activePath?: string;
  className?: string;
}

function isActive(pathname: string, item: AppSidebarItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppSidebar({ brand, groups, footer, activePath, className }: AppSidebarProps) {
  const routerPathname = usePathname();
  const pathname = activePath ?? routerPathname;

  return (
    <Sidebar collapsible="icon" className={className}>
      <SidebarHeader>
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
          <Link
            href={brand.href ?? '/'}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 font-semibold group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:p-0"
          >
            {brand.logo && (
              <span className="flex size-6 shrink-0 items-center justify-center">{brand.logo}</span>
            )}
            <span className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
              <span className="truncate leading-tight">{brand.title}</span>
              {brand.subtitle && (
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {brand.subtitle}
                </span>
              )}
            </span>
          </Link>
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
