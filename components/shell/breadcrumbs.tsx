'use client';

// Copied from ui-kit registry `thiengthb/breadcrumbs` (shadcn add breadcrumbs). Generic renderer —
// the app supplies the trail (see app-breadcrumbs.tsx). Keep in sync with the registry if edited.

import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Explain } from '@/components/shared/explain';
import { cn } from '@/lib/utils';

/**
 * One node in a breadcrumb trail. Every crumb carries an icon AND a description (shown as a
 * hover/focus tooltip) so the trail is legible at a glance and each step explains where it leads.
 * The LAST crumb is the current page: it renders as plain (aria-current) text with no link even if
 * an `href` is supplied.
 */
export interface Crumb {
  label: string;
  /** Target route. Omitted (or ignored on the last crumb) → non-navigating current page. */
  href?: string;
  /** lucide icon — required so every step is visually anchored. */
  icon: LucideIcon;
  /** One-line explanation of the destination — surfaced as a tooltip. */
  description: string;
}

/**
 * Config-driven breadcrumb trail: pass an ordered `Crumb[]` from root → current. Renders an
 * accessible `nav > ol`, each item = icon + label (+ description tooltip), separated by a chevron;
 * intermediate crumbs link, the final one marks the current page.
 *
 * NOTE — NEXT-ONLY: uses `next/link`. Needs a `TooltipProvider` ancestor (in the root layout).
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          const Icon = item.icon;
          // MOBILE (2026-08-04): a parent crumb shows its ICON only, the current page shows its NAME
          // only. Full "icon + label" for every step wrapped onto two or three lines at 360px, which
          // pushed the page body down and made the trail the loudest thing on screen. Splitting the
          // roles keeps one line: icons say "where in the app", the name says "what you are looking
          // at". Both come back at md+, where there is width for them.
          //
          // The parent's label is not lost — it stays in the DOM as sr-only, so the trail still reads
          // "Tài nguyên › Ngữ pháp › 〜ばかりに" to a screen reader at every width.
          const inner = (
            <span
              className={cn(
                'inline-flex items-center gap-1.5',
                last && 'font-medium text-foreground',
              )}
            >
              <Icon
                className={cn('size-4 shrink-0', last && 'max-md:hidden')}
                aria-hidden
              />
              <span className={cn('max-w-[18ch] truncate', !last && 'max-md:sr-only')}>
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
