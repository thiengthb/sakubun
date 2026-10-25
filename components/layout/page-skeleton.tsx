import { type ReactNode } from 'react';
import { cn } from '@/lib/core/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AppBreadcrumbs,
  type BreadcrumbAction,
  type BreadcrumbSection,
} from '@/components/layout/app-breadcrumbs';
import { BreadcrumbPlaceholder } from '@/components/layout/breadcrumbs';
import { FORM_FOOTER, PAGE_CHROME } from '@/components/layout/page-chrome';
import type { PageTemplate } from '@/components/layout/page-shell';

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
  template,
  title,
  meta,
  actions,
  actionsOnPhone = 'inline',
  pageIcons,
  trail = false,
  tabs,
  width = 'full',
  section,
  action,
  aside,
  className,
}: {
  children?: ReactNode;
  /** Template pages: the same chrome as PageShell's, from page-chrome.ts. */
  template?: PageTemplate;
  /** Template pages: the h1, known up front for a top page; a bar for a record's name. */
  title?: string;
  /** Template pages: a bar where the page shows its meta line (a count the skeleton cannot know), or its own shape. */
  meta?: boolean | ReactNode;
  /** Template pages: placeholders right of the title, as wide as the page's buttons. */
  actions?: ReactNode;
  /** As PageShell's: 'split' puts the actions on a row of their own on a phone. */
  actionsOnPhone?: 'inline' | 'split';
  /** Template pages: placeholders at the end of the title's row (star). */
  pageIcons?: ReactNode;
  /** Template pages: a nested page, with a parent trail above the title. */
  trail?: boolean;
  tabs?: ReactNode;
  width?: PageWidth;
  section?: BreadcrumbSection;
  action?: BreadcrumbAction;
  aside?: ReactNode;
  className?: string;
}) {
  if (template) {
    const split = actionsOnPhone === 'split';
    const metaShape =
      meta === true ? (
        <div className="flex h-4 items-center">
          <Skeleton className="h-3 w-20" />
        </div>
      ) : (
        meta
      );
    return (
      <div className={cn(PAGE_CHROME.page, className)} data-template={template}>
        <div className={PAGE_CHROME.header}>
          <div className={PAGE_CHROME.stack}>
            <div className={PAGE_CHROME.trail}>{trail && <Skeleton className="h-3 w-36" />}</div>
            <div className={PAGE_CHROME.row}>
              <div className="flex shrink-0 items-center md:hidden">
                <Skeleton className="size-9 rounded-sm" />
              </div>
              <div className={PAGE_CHROME.block}>
                {trail && (
                  <div className={PAGE_CHROME.phoneTrail}>
                    <Skeleton className="h-3 w-28" />
                  </div>
                )}
                <h1 className={PAGE_CHROME.title}>
                  {title ?? (
                    // One invisible line keeps the h1 at its own height; the bar sits inside it.
                    <span className="relative block" aria-hidden>
                      <span className="invisible">あ</span>
                      <Skeleton className="absolute inset-y-0.5 left-0 w-40 md:inset-y-1" />
                    </span>
                  )}
                </h1>
                {meta && (
                  <div className={cn(PAGE_CHROME.meta, trail && 'max-md:hidden')}>{metaShape}</div>
                )}
              </div>
              {actions && (
                <div className={cn(PAGE_CHROME.actions, split && 'max-md:hidden')}>{actions}</div>
              )}
              {pageIcons && <div className={PAGE_CHROME.pageIcons}>{pageIcons}</div>}
            </div>
          </div>
          {trail && meta && <div className={PAGE_CHROME.phoneMeta}>{metaShape}</div>}
          {actions && split && <div className={PAGE_CHROME.phoneActions}>{actions}</div>}
          {tabs && <div className={PAGE_CHROME.tabs}>{tabs}</div>}
        </div>
        {children}
      </div>
    );
  }
  return (
    <div className={cn('w-full min-w-0 space-y-4 pt-6 pb-6 text-sm', WIDTH[width], className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 max-md:flex-nowrap max-md:gap-x-2">
        <div className="flex shrink-0 items-center md:hidden">
          <Skeleton className="size-9 rounded-sm" />
        </div>
        {section ? (
          <div className="flex min-w-0 max-md:shrink-0">
            <AppBreadcrumbs section={section} action={action} />
          </div>
        ) : (
          // A detail page's crumb ends in the entity's name, which the skeleton cannot know. An
          // invisible one-crumb trail holds the row at the breadcrumb's own height, whatever the
          // body size, at a fixed width, and the bar is drawn over it.
          <div className="relative flex w-44 shrink-0 overflow-hidden max-md:w-28" aria-hidden>
            <BreadcrumbPlaceholder className="invisible" />
            <Skeleton className="absolute inset-y-0.5 inset-x-0" />
          </div>
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
      <Skeleton className="h-9 shrink-0 rounded-sm md:hidden" style={{ width: select }} />
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

/** Underline tabs on a template page: `count` words on the tabs row. */
export function PageTabsSkeleton({ count, widths = [] }: { count: number; widths?: number[] }) {
  return (
    <div className="flex h-8 items-center gap-4">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-4 rounded-sm" style={{ width: widths[i] ?? 64 }} />
      ))}
    </div>
  );
}

/** The form template's footer, as tall as FormFooter with one button. */
export function FormFooterSkeleton({ status = true }: { status?: boolean }) {
  return (
    <div className={FORM_FOOTER.bar}>
      {status && (
        <div className={FORM_FOOTER.status}>
          <Skeleton className="h-3 w-36" />
        </div>
      )}
      <div className={FORM_FOOTER.actions}>
        <Skeleton className="h-9 w-20 rounded-sm md:h-7" />
      </div>
    </div>
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
            {/* Field's label is a bold 14px line. */}
            <div className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-28" />
            </div>
            <Skeleton className="h-9 w-full rounded-sm md:h-7" />
          </div>
        ))}
        {footer && (
          <div className="flex flex-wrap items-center gap-3 px-4 pt-2">
            <Skeleton className="h-3 w-32" />
            <div className="ml-auto flex gap-2 max-sm:w-full max-sm:[&>*]:flex-1">
              <Skeleton className="h-9 w-20 rounded-sm md:h-7" />
              <Skeleton className="h-9 w-24 rounded-sm md:h-7" />
            </div>
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
      <Skeleton className="h-9 min-w-0 flex-1 rounded-sm sm:max-w-xs md:h-7" />
      <div className="flex shrink-0 items-center gap-2 md:ml-auto">
        {columnMenu && <Skeleton className="size-7 rounded-sm max-lg:hidden" />}
        {/* Filter and sort are labelled buttons ("Lọc", "Sắp xếp"), not bare icons. */}
        {Array.from({ length: filters }, (_, i) => (
          <Skeleton key={i} className="h-9 w-16 rounded-sm md:h-7" />
        ))}
        {action && <Skeleton className="size-9 rounded-sm md:size-7" />}
      </div>
    </div>
  );
}
