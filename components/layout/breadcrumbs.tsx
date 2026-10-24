'use client';

import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Explain } from '@/components/common/explain';
import { cn } from '@/lib/core/utils';

export interface Crumb {
  label: string;
  href?: string;
  icon: LucideIcon;
  description: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;
  const compress = items.length > 2;
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1;
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
              {!last && (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
