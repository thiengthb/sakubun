'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Loader2, type LucideIcon } from 'lucide-react';
import { Explain } from '@/components/common/explain';
import { ButtonLink, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/core/utils';

export interface Crumb {
  label: string;
  href?: string;
  /** Drawn before the label; a deep trail draws it on its root only. */
  icon?: LucideIcon;
  description: string;
  /** A loading screen's crumb that waits on data: drawn as a bar as wide as `label`. */
  pending?: boolean;
}

export function Breadcrumbs({
  items,
  className,
  parentsOnly = false,
  back,
}: {
  items: Crumb[];
  className?: string;
  /** Every crumb is a parent link: a template page names itself with its h1. */
  parentsOnly?: boolean;
  /**
   * On a phone, one way back to the nearest parent in place of the trail (KN1,
   * docs/plans/2026-11-19-kho-navigation.md): a row of small crumbs was hard to read and to hit.
   * `button` where the header has a 36px row for it (the detail header), `link` in the template's
   * 16px trail line.
   */
  back?: 'button' | 'link';
}) {
  if (items.length === 0) return null;
  const up = parentsOnly ? items[items.length - 1] : undefined;
  // A loading screen draws the same button, its label a bar, so the header does not jump.
  const canGoBack = Boolean(back && up && (up.href || up.pending));
  const compress = !parentsOnly && items.length > 2;
  return (
    <nav
      aria-label="Breadcrumb"
      className={className}
      data-parents={parentsOnly || undefined}
      data-back={canGoBack || undefined}
    >
      {up && canGoBack && <BackTo crumb={up} look={back!} />}
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground in-data-parents:text-xs in-data-back:max-md:hidden">
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
              {Icon && (
                <Icon
                  className={cn('size-4 shrink-0', (last || !compress) && 'max-md:hidden')}
                  aria-hidden
                />
              )}
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

// Flat, not a raised button (thien, KN1 review): the chevron lines up with the page's left edge.
const FLAT_BACK = 'max-w-full -translate-x-2 md:hidden';

function BackTo({ crumb, look }: { crumb: Crumb; look: 'button' | 'link' }) {
  const label = crumb.pending ? (
    <span data-pending className="relative inline-flex min-w-12">
      <span className="invisible">{crumb.label}</span>
      <Skeleton aria-hidden className="absolute inset-x-0 inset-y-0.5 rounded-sm" />
    </span>
  ) : (
    <span className="truncate">{crumb.label}</span>
  );
  if (look === 'button') {
    const body = (
      <>
        <ChevronLeft data-icon="inline-start" aria-hidden />
        {label}
      </>
    );
    return crumb.pending || !crumb.href ? (
      <span className={cn(buttonVariants({ variant: 'ghost' }), FLAT_BACK)}>{body}</span>
    ) : (
      <ButtonLink href={crumb.href} variant="ghost" className={FLAT_BACK}>
        {body}
      </ButtonLink>
    );
  }
  const linkLook =
    'target-44 inline-flex min-w-0 items-center gap-0.5 text-xs font-medium text-foreground md:hidden';
  const body = (
    <>
      <ChevronLeft className="size-4 shrink-0" aria-hidden />
      {label}
    </>
  );
  return crumb.pending || !crumb.href ? (
    <span className={linkLook}>{body}</span>
  ) : (
    <Link href={crumb.href} className={linkLook}>
      {body}
    </Link>
  );
}
