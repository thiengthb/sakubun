import { type ReactNode } from 'react';
import { cn } from '@/lib/core/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AppBreadcrumbs,
  type BreadcrumbAction,
  type BreadcrumbSection,
} from '@/components/layout/app-breadcrumbs';

export {
  FitList,
  TableSkeleton,
  CardGridSkeleton,
  CardsSkeleton,
  ListSkeleton,
  TabbedSkeleton,
} from '@/components/common/fit-skeleton';

type PageWidth = 'full' | 'wide' | 'narrow' | 'form';

const WIDTH: Record<PageWidth, string> = {
  full: '',
  wide: 'mx-auto max-w-5xl',
  narrow: 'mx-auto max-w-3xl',
  form: 'mx-auto max-w-2xl',
};

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
  section?: BreadcrumbSection;
  action?: BreadcrumbAction;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('w-full min-w-0 space-y-4 pt-6 pb-6 text-body', WIDTH[width], className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 max-md:flex-nowrap max-md:gap-x-2">
        <div className="flex shrink-0 items-center gap-2 md:hidden">
          <Skeleton className="size-6 rounded-md" />
          <div className="h-5 w-px bg-border" aria-hidden />
        </div>
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

export function TabsAside({
  count = 2,
  rail = 160,
  select = 112,
}: {
  count?: number;
  rail?: number;
  select?: number;
}) {
  return (
    <>
      <Skeleton className="h-8 shrink-0 rounded-lg md:hidden" style={{ width: select }} />
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

export function FormCardSkeleton({
  fields = 4,
  footer = true,
  intro = false,
}: {
  fields?: number;
  footer?: boolean;
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

export function ToolbarSkeleton({
  action = false,
  filters = 1,
  columnMenu = false,
}: {
  action?: boolean;
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
