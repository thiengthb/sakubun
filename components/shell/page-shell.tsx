import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AppBreadcrumbs, type BreadcrumbSection } from '@/components/shell/app-breadcrumbs';
import { MobileTopBar } from '@/components/shell/mobile-top-bar';
import { ScrollRestorer } from '@/components/shell/scroll-restorer';

/**
 * The one page wrapper every route uses — the single source of truth for page-level rhythm.
 *
 * The app shell (`app-shell.tsx`) owns only horizontal width + side padding; before this, every page
 * hand-rolled its own `py-8 space-y-6` + max-width + breadcrumb, which drifted (some pages had no
 * breadcrumb, max-widths ranged max-w-2xl…max-w-5xl at random). `PageShell` centralises all of that:
 * vertical padding, vertical rhythm, an optional content max-width, and the breadcrumb slot. New
 * pages wrap their content in it instead of reinventing the container.
 *
 * Server component (renders the client `AppBreadcrumbs` from a plain `section` string), so it drops
 * straight into a server page. Tabbed pages pass their `<TabsList>` (and any right-aligned action)
 * as `headerAside` — the platform standard is that tabs sit BESIDE the breadcrumb on one row (like
 * the resources page). The page description is NOT a paragraph here; it lives in the breadcrumb
 * label's hover description (`app-breadcrumbs.tsx` `CRUMBS[section].description`).
 */

type PageWidth = 'full' | 'wide' | 'narrow' | 'form';

// `full` inherits the shell's max-w-7xl (data-dense pages: tables, history grid, dashboard).
// The narrower tiers centre reading-width content (detail, forms, admin).
const WIDTH: Record<PageWidth, string> = {
  full: '',
  wide: 'mx-auto max-w-5xl',
  narrow: 'mx-auto max-w-3xl',
  form: 'mx-auto max-w-2xl',
};

interface PageShellProps {
  children: ReactNode;
  /** Auto-render the breadcrumb trail for this section at the top of the page. */
  section?: BreadcrumbSection;
  /** Custom breadcrumb node (overrides `section`) — for a detail trail. */
  breadcrumb?: ReactNode;
  /** Rendered on the breadcrumb row, to its right — a `<TabsList>` and/or a page action button. */
  headerAside?: ReactNode;
  /** Content max-width tier. Defaults to `full` (inherits the shell's max-w-7xl). */
  width?: PageWidth;
  className?: string;
}

export function PageShell({
  children,
  section,
  breadcrumb,
  headerAside,
  width = 'full',
  className,
}: PageShellProps) {
  const crumb = breadcrumb ?? (section ? <AppBreadcrumbs section={section} /> : null);
  return (
    // `text-sm` is the app's BODY BASELINE (type-scale invariant): page content inherits 14px, so a
    // bare content block never renders larger than a heading. Headings opt UP (CardTitle = text-base,
    // section titles = text-base/lg); meta opts DOWN (text-xs). Enforced by lib/type-scale.test.ts.
    <div className={cn('space-y-4 py-6 text-sm', WIDTH[width], className)}>
      {/* Remember scroll position per route (long pages only; list pages are viewport-fit). */}
      <ScrollRestorer />
      {/* Header row: breadcrumb + any page-supplied aside (tabs, actions). Kept unconditional so
          every page's body starts at the same vertical offset. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Mobile only (md:hidden): app icon + open-sidebar button + a divider, since the sidebar's
            own brand/toggle are off-screen once it collapses to the off-canvas Sheet. */}
        <MobileTopBar />
        {crumb}
        {headerAside}
      </div>
      {children}
    </div>
  );
}
