import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// The data-shaped LEAF skeletons live in a client module because they self-measure the viewport to
// fit their item count (the loading twin of the pagination fit). Re-exported here so every route
// `loading.tsx` keeps one import surface: `@/components/shell/page-skeleton`.
export {
  FitList,
  TableSkeleton,
  CardGridSkeleton,
  ListSkeleton,
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
 * Loading scaffold that mirrors `PageShell`'s frame — the same vertical rhythm (`space-y-4 py-6`),
 * width tier, and a breadcrumb-row placeholder (with an optional tabs/action `aside`). Each route's
 * `loading.tsx` composes its data-shaped skeletons as children, so the placeholder matches the real
 * layout instead of a generic block (the drift the user flagged). Build the frame once; routes only
 * describe their body via the helpers below.
 */
export function PageSkeleton({
  children,
  width = 'full',
  aside,
  className,
}: {
  children?: ReactNode;
  width?: PageWidth;
  /** Right-of-breadcrumb placeholder — a tabs list and/or a page action, mirroring headerAside. */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4 py-6', WIDTH[width], className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* No MobileTopBar here (unlike PageShell): the root loading.tsx is the Suspense fallback for
            EVERY route, including chromeless auth pages where AppShell mounts no SidebarProvider — its
            SidebarTrigger would throw. A transient loading state doesn't need the sidebar toggle. */}
        {/* Breadcrumb trail placeholder (matches AppBreadcrumbs' single-line height). */}
        <Skeleton className="h-5 w-44" />
        {aside}
      </div>
      {children}
    </div>
  );
}

/** A `<TabsList>` placeholder for `aside` — `count` pill-shaped triggers on one rail. */
export function TabsAside({ count = 2 }: { count?: number }) {
  return (
    <div className="ml-auto flex gap-1 rounded-lg bg-muted p-1">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-7 w-24 rounded-md" />
      ))}
    </div>
  );
}

/**
 * The search + filter (+ optional action) row that sits above a table/grid on most data pages.
 * `action` adds a right-aligned button placeholder (e.g. "Tạo …").
 */
export function ToolbarSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Skeleton className="h-8 w-full max-w-xs" />
      <Skeleton className="size-8 rounded-md" />
      {action && <Skeleton className="ml-auto h-8 w-28 rounded-md" />}
    </div>
  );
}
