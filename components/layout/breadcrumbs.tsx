'use client';

import Link from 'next/link';
import { ChevronRight, Loader2, type LucideIcon } from 'lucide-react';
import { Explain } from '@/components/common/explain';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/core/utils';

export interface Crumb {
  label: string;
  href?: string;
  icon: LucideIcon;
  description: string;
  /** A loading screen's crumb that waits on data: drawn as a bar as wide as `label`. */
  pending?: boolean;
}

export function Breadcrumbs({
  items,
  className,
  parentsOnly = false,
}: {
  items: Crumb[];
  className?: string;
  /** Every crumb is a parent link: a template page names itself with its h1. */
  parentsOnly?: boolean;
}) {
  if (items.length === 0) return null;
  const compress = !parentsOnly && items.length > 2;
  return (
    <nav aria-label="Breadcrumb" className={className} data-parents={parentsOnly || undefined}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground in-data-parents:text-xs">
        {items.map((item, i) => {
          const last = !parentsOnly && i === items.length - 1;
          const end = i === items.length - 1;
          const Icon = item.icon;
          const inner = (
            <span
              className={cn(
                'inline-flex items-center gap-1.5',
                last && 'font-medium text-foreground',
              )}
            >
              <Icon
                className={cn('size-4 shrink-0', (last || !compress) && 'max-md:hidden')}
                aria-hidden
              />
              <span
                className={cn(
                  'max-w-[18ch] truncate',
                  last && 'max-md:max-w-[12ch]',
                  !last && compress && 'max-md:sr-only',
                )}
              >
                {item.label}
              </span>
            </span>
          );
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {item.pending ? (
                <span data-pending className="relative inline-flex">
                  <span className="invisible">{inner}</span>
                  <Skeleton aria-hidden className="absolute inset-x-0 inset-y-0.5 rounded-sm" />
                </span>
              ) : (
                <Explain text={item.description}>
                  {item.href && !last ? (
                    <Link
                      href={item.href}
                      className="inline-flex items-center rounded-md transition-colors hover:text-foreground"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <span aria-current={last ? 'page' : undefined}>{inner}</span>
                  )}
                </Explain>
              )}
              {!end && (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// A one-crumb trail for a skeleton that cannot know the page's crumbs. It lives here, in the client
// module, because an icon component cannot cross from a server component into a client one.
export function BreadcrumbPlaceholder({ className }: { className?: string }) {
  return (
    <Breadcrumbs
      items={[{ label: 'Đang tải', icon: Loader2, description: '' }]}
      className={className}
    />
  );
}
