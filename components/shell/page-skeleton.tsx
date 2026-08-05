import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AppBreadcrumbs,
  type BreadcrumbAction,
  type BreadcrumbSection,
} from '@/components/shell/app-breadcrumbs';

// The data-shaped LEAF skeletons live in a client module because they self-measure the viewport to
// fit their item count (the loading twin of the pagination fit). Re-exported here so every route
// `loading.tsx` keeps one import surface: `@/components/shell/page-skeleton`.
export {
  FitList,
  TableSkeleton,
  CardGridSkeleton,
  CardsSkeleton,
  ListSkeleton,
  TabbedSkeleton,
} from '@/components/shared/fit-skeleton';

type PageWidth = 'full' | 'wide' | 'narrow' | 'form';

// Mirror PageShell's WIDTH tiers so a route's loading state has the SAME container width as the page
// it stands in for (a narrow form must not flash full-bleed then snap narrow, and vice-versa).
const WIDTH: Record<PageWidth, string> = {
  full: '',
  wide: 'mx-auto max-w-5xl',
  narrow: 'mx-auto max-w-3xl',
  form: 'mx-auto max-w-2xl',
};

/**
 * Loading scaffold that mirrors `PageShell` — same padding, same rhythm, same width tier, and the SAME
 * HEADER ROW at every breakpoint. Each route's `loading.tsx` composes its data-shaped skeletons as
 * children.
 *
 * The header row is copied from PageShell class for class, and that is the point: it is the one row that
 * exists on every page, so any difference shows up as a jump on EVERY navigation. Rebuilt 2026-08-05
 * after measuring both against each other (`e2e/skeleton.spec.ts` now keeps them equal):
 *   - the MOBILE TOP BAR placeholder was missing entirely, so below `md` the crumb started at the page's
 *     left edge and jumped ~41px right the moment real content arrived. Its geometry is reproduced here
 *     (a 24px logo + 8px gap + a 1px divider = 33px, measured) rather than by rendering `MobileTopBar` —
 *     that component's SidebarTrigger throws on the chromeless auth pages this fallback also covers.
 *   - the aside was pinned `ml-auto` at EVERY width, while PageShell pins it right only below `md` and
 *     puts it beside the crumb (`md:ml-0 md:flex-1`) above. On a 1440px desktop the tabs therefore flew
 *     ~900px leftwards when the page loaded.
 *   - the row lacked `max-md:flex-nowrap`, so a wide aside (5 settings tabs) WRAPPED the skeleton row to
 *     two lines — and, worse, overflowed a 390px phone by 134px, because a wrapped `ml-auto` block still
 *     cannot shrink. PageShell forbids wrapping here for exactly that reason.
 */
export function PageSkeleton({
  children,
  width = 'full',
  section,
  action,
  aside,
  className,
}: {
  children?: ReactNode;
  width?: PageWidth;
  /**
   * Render the route's REAL breadcrumb instead of a grey pill. Every route whose trail is static (all but
   * the two detail pages, whose last crumb is the item's own name) passes this, and it is what makes the
   * header row geometry EXACT rather than approximately right: the crumb's width is the thing that sets
   * where the tabs begin on a desktop, and a fixed-width placeholder put them ~75px off. It is also
   * honest — the trail is known before the data is, so the page can say where you are immediately.
   */
  section?: BreadcrumbSection;
  /** With `section`, the action crumb ("› Thêm", "› Sửa") — same prop PageShell takes. */
  action?: BreadcrumbAction;
  /** Right-of-breadcrumb placeholder — a tabs list and/or a page action, mirroring headerAside. */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('w-full min-w-0 space-y-4 pt-6 pb-6 text-sm', WIDTH[width], className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 max-md:flex-nowrap max-md:gap-x-2">
        {/* MobileTopBar's footprint (md:hidden): the logo button + the vertical divider. */}
        <div className="flex shrink-0 items-center gap-2 md:hidden">
          <Skeleton className="size-6 rounded-md" />
          <div className="h-5 w-px bg-border" aria-hidden />
        </div>
        {/* The real trail when the route knows it; otherwise a placeholder (detail pages, whose last
            crumb is the item name we are still loading). */}
        {section ? (
          <div className="flex min-w-0 max-md:shrink-0">
            <AppBreadcrumbs section={section} action={action} />
          </div>
        ) : (
          <Skeleton className="h-6 w-44 shrink-0 max-md:w-28" />
        )}
        {aside && (
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2 max-md:flex-nowrap md:ml-0 md:flex-1">
            {aside}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * The header-row tab switcher placeholder — the loading twin of `TabSelect`, which is a `TabsList` from
 * `md` up and a SELECT below it. Rendering the rail at every width (what this did until 2026-08-05) drew
 * a 400px, 5-pill rail on a 390px phone that the real page never shows.
 *
 * `rail` / `select` are the MEASURED widths of the real control on that page (px), so the placeholder is
 * not merely the right shape but the right size — see the table in `e2e/skeleton.spec.ts`. The pills
 * divide the rail with `flex-1`, so the rail width is exact whatever the tab count.
 */
export function TabsAside({
  count = 2,
  rail = 160,
  select = 112,
}: {
  count?: number;
  /** Measured width of the real `TabsList` at `md`+ (px). */
  rail?: number;
  /** Measured width of the real select trigger below `md` (px). */
  select?: number;
}) {
  return (
    <>
      <Skeleton className="h-8 shrink-0 rounded-lg md:hidden" style={{ width: select }} />
      {/* `h-8` + `p-[3px]` are the real TabsList's own metrics — with `p-1` + `h-7` pills the rail came
          out 36px and made the whole header row 4px taller than the page's. */}
      <div
        className="hidden h-8 shrink-0 items-center gap-1 rounded-lg bg-muted p-[3px] md:flex"
        style={{ width: rail }}
      >
        {Array.from({ length: count }, (_, i) => (
          <Skeleton key={i} className="h-full flex-1 rounded-md" />
        ))}
      </div>
    </>
  );
}

/**
 * A form CARD placeholder — the shape every form route uses (`Card` = `rounded-xl bg-card ring-1` with
 * `py-4 gap-4` and `px-4` content): `fields` label+control pairs, then the action row that closes the
 * card. Used by the four form routes (/resources/new, /resources/<id>/edit, /groups/new,
 * /groups/<id>/edit) so their loading state is a form, not one tall grey rectangle.
 */
export function FormCardSkeleton({
  fields = 4,
  footer = true,
  intro = false,
}: {
  fields?: number;
  /** The submit/cancel row at the end of the card. */
  footer?: boolean;
  /** A description line ABOVE the card, which most form routes carry. */
  intro?: boolean;
}) {
  return (
    <>
      {intro && <Skeleton className="h-5 w-full max-w-md max-md:h-9" />}
      <div className="flex flex-col gap-4 rounded-xl bg-card py-4 ring-1 ring-foreground/10">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-1.5 px-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        ))}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-4">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        )}
      </div>
    </>
  );
}

/**
 * The list toolbar — the shape `DataTable` and the group/vocab lists all share: ONE row at every width
 * (never wrapping), a search box that shrinks, then icon-sized actions pinned right.
 *
 * `columnMenu` mirrors the table's own column chooser, which is `max-md:hidden` because below `md` the
 * table is replaced by cards and there are no columns to hide.
 */
export function ToolbarSkeleton({
  action = false,
  filters = 1,
  columnMenu = false,
}: {
  /** A primary action button at the end of the row ("Tạo nhóm", "Thêm mục"). */
  action?: boolean;
  /** How many icon-sized filter/utility buttons sit before the action. */
  filters?: number;
  columnMenu?: boolean;
}) {
  return (
    <div className="flex flex-row items-center gap-2 sm:gap-3">
      <Skeleton className="h-8 min-w-0 flex-1 rounded-lg sm:max-w-xs" />
      <div className="flex shrink-0 items-center gap-2 md:ml-auto">
        {columnMenu && <Skeleton className="size-8 rounded-md max-md:hidden" />}
        {Array.from({ length: filters }, (_, i) => (
          <Skeleton key={i} className="size-8 rounded-md" />
        ))}
        {action && <Skeleton className="size-8 rounded-md" />}
      </div>
    </div>
  );
}
