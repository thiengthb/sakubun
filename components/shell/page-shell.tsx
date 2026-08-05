import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  AppBreadcrumbs,
  type BreadcrumbAction,
  type BreadcrumbSection,
} from '@/components/shell/app-breadcrumbs';
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
  /** With `section`, appends an action crumb: "Ngữ pháp › Thêm" on /resources/new, "› Sửa" on the edit route. */
  action?: BreadcrumbAction;
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
  action,
  breadcrumb,
  headerAside,
  width = 'full',
  className,
}: PageShellProps) {
  const crumb =
    breadcrumb ?? (section ? <AppBreadcrumbs section={section} action={action} /> : null);
  return (
    // `text-sm` is the app's BODY BASELINE (type-scale invariant): page content inherits 14px, so a
    // bare content block never renders larger than a heading. Headings opt UP (CardTitle = text-base,
    // section titles = text-base/lg); meta opts DOWN (text-xs). Enforced by lib/type-scale.test.ts.
    // `pb-6`, down from `pb-16` (2026-08-05, reported as dead space under the pagination bar).
    // The 64px was a gutter for the floating back-to-top button (`ScrollToTop`, fixed bottom-right,
    // spanning 16–56px up from the viewport edge). The reservation was self-defeating: that button only
    // appears once the page is scrolled past 300px, and every page with a pagination footer sizes its
    // page to FIT THE VIEWPORT (`useFitRows`) — so those pages never scroll, the button never appears,
    // and the 64px was pure dead space below the footer on exactly the pages that reserved it. Pages
    // that DO scroll (guide, dashboard) end in prose, not in a control the button could cover.
    // `useFitRows`' `bottomGap` default mirrors this number — change the two together, or the
    // viewport-fit lists will fit one row too many and bring back the page scrollbar.
    // `w-full min-w-0` is load-bearing, not defensive — it is what keeps a tabbed page inside the phone.
    // Every tabbed page renders this shell INSIDE a `<Tabs>` root, which is `display:flex`, so this div is
    // a FLEX ITEM. With `width:auto` the browser sized it from its CONTENT instead of stretching it to the
    // container: measured on /guide?tab=reference at 390px, the Tabs root was 358px wide and this div came
    // out 608px (computed width, not overflow), so the whole page scrolled sideways 234px and `max-w-3xl`
    // looked like it was being ignored. `max-w-*` and `min-w-0` alone did NOT fix it; `w-full` did, because
    // it pins the cross size to the container instead of the content. Same pairing `app-shell.tsx` already
    // uses on <main> (`mx-auto w-full max-w-7xl min-w-0`).
    // Consequence worth keeping: a too-wide descendant now overflows ALONE, so its own `overflow-x-auto`
    // can contain it and e2e/mobile-layout.spec.ts can name the element instead of blaming the page.
    <div className={cn('w-full min-w-0 space-y-4 pt-6 pb-6 text-sm', WIDTH[width], className)}>
      {/* Remember scroll position per route (long pages only; list pages are viewport-fit). */}
      <ScrollRestorer />
      {/* Header row: breadcrumb, then the page-supplied aside (tabs, actions). Kept unconditional so
          every page's body starts at the same vertical offset.
          POSITION IS BREAKPOINT-DEPENDENT, on purpose:
            - md and up: the aside sits BESIDE the breadcrumb (`md:ml-0`), which is the platform layout
              standard (fleet platform/standards/ui-layout.md rule 2) — one header row reading
              "where I am · what I can switch", with the tabs adjacent to the thing they belong to.
            - below md: `ml-auto` pushes it to the right edge instead. On a phone the row is the app
              icon + sidebar button + a short crumb, and a tab control butted against that reads as a
              fourth item in a cramped cluster; pinned right it is clearly its own control, and it is
              also where the thumb is. */}
      {/* Below md the row is `flex-nowrap`: the aside is REQUIRED to stay beside the crumb (that is the
          whole ask — tabs pinned right, on the breadcrumb's row), so wrapping is not an acceptable
          fallback. Both children get `min-w-0` and the shrink lands on the tab pill's own `truncate`,
          which is the only part of the row that degrades gracefully. From md the row has width to
          spare and goes back to wrapping. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 max-md:flex-nowrap max-md:gap-x-2">
        {/* Mobile only (md:hidden): app icon + open-sidebar button + a divider, since the sidebar's
            own brand/toggle are off-screen once it collapses to the off-canvas Sheet. */}
        <MobileTopBar />
        {/* `shrink-0` below md: when the row runs out of width the crumb must NOT be the thing that
            gives — it is the page's identity, and squeezing it just wraps "Ngữ pháp › Thêm" onto two
            lines inside its own nav. The give belongs to the tab pill, which truncates. */}
        {crumb && <div className="flex min-w-0 max-md:shrink-0">{crumb}</div>}
        {headerAside && (
          // `md:flex-1` matters: some pages pass tabs AND a right-aligned action (the Settings Save
          // button carries its own `ml-auto`). Letting the wrapper fill the rest of the row on desktop
          // keeps the tabs at its left edge — beside the crumb — while that inner `ml-auto` can still
          // push the action to the far right. Without it the wrapper hugs its content and the action
          // lands glued to the tabs.
          // `max-md:flex-nowrap` for the same reason as the row itself: /guide puts a tab select AND a
          // hint button in here, and on a phone they wrapped against each other (a 72px header row)
          // even while the outer row had space.
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2 max-md:flex-nowrap md:ml-0 md:flex-1">
            {headerAside}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
