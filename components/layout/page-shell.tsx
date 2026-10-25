import { type ReactNode } from 'react';
import { cn } from '@/lib/core/utils';
import {
  AppBreadcrumbs,
  type BreadcrumbAction,
  type BreadcrumbSection,
} from '@/components/layout/app-breadcrumbs';
import { MobileTopBar } from '@/components/layout/mobile-top-bar';
import { FORM_FOOTER, PAGE_CHROME } from '@/components/layout/page-chrome';
import { ScrollRestorer } from '@/components/layout/scroll-restorer';
import { DetailHeader, type HeaderFact } from '@/components/layout/detail-header';

/**
 * The four page templates of docs/ui-standard.md. A page that passes `template` gets the new header
 * (title, meta, actions, tabs); one that does not keeps the old breadcrumb row until its step-6 PR.
 * - list: a collection with search and filter; cards below 1024px, a table from 1024px.
 * - detail: one record; facts as equal tiles, then sections.
 * - form: settings and create/edit; footer with the save action.
 * - dashboard: numbers; stat row, then panels.
 */
export type PageTemplate = 'list' | 'detail' | 'form' | 'dashboard';

type PageWidth = 'full' | 'wide' | 'narrow' | 'form';

const WIDTH: Record<PageWidth, string> = {
  full: '',
  wide: 'mx-auto max-w-5xl',
  narrow: 'mx-auto max-w-3xl',
  form: 'mx-auto max-w-2xl',
};

interface PageShellProps {
  children: ReactNode;
  template?: PageTemplate;
  /** Template pages: the h1. */
  title?: ReactNode;
  /** Template pages: one line under the title (a count, a subtitle). */
  meta?: ReactNode;
  /** Template pages: right of the title, one primary action and at most two secondary. */
  actions?: ReactNode;
  /** Phone: 'inline' keeps the actions on the title's row; 'split' gives them a row of their own. */
  actionsOnPhone?: 'inline' | 'split';
  /** Template pages: end of the title's row, icon toggles about the page itself (star). */
  pageIcons?: ReactNode;
  /** Template pages: underline tabs under the header. */
  tabs?: ReactNode;
  /** Template pages with a lot to say about one thing: the lines under the title (a meaning). */
  subtitle?: ReactNode;
  /** With `subtitle`: labelled values under it (level, state). Switches to the detail header. */
  facts?: HeaderFact[];
  section?: BreadcrumbSection;
  action?: BreadcrumbAction;
  breadcrumb?: ReactNode;
  headerAside?: ReactNode;
  width?: PageWidth;
  className?: string;
}

export function PageShell({
  children,
  template,
  title,
  meta,
  actions,
  actionsOnPhone = 'inline',
  pageIcons,
  tabs,
  subtitle,
  facts,
  section,
  action,
  breadcrumb,
  headerAside,
  width = 'full',
  className,
}: PageShellProps) {
  if (template && facts) {
    return (
      <div className={cn(PAGE_CHROME.page, className)} data-template={template}>
        <ScrollRestorer />
        <DetailHeader
          breadcrumb={breadcrumb}
          title={title}
          subtitle={subtitle}
          facts={facts}
          actions={actions}
          pageIcons={pageIcons}
          tabs={tabs}
        />
        {children}
      </div>
    );
  }
  if (template) {
    const split = actionsOnPhone === 'split';
    return (
      <div className={cn(PAGE_CHROME.page, className)} data-template={template}>
        <ScrollRestorer />
        <header className={PAGE_CHROME.header}>
          <div className={PAGE_CHROME.stack}>
            {breadcrumb && <div className={PAGE_CHROME.trail}>{breadcrumb}</div>}
            <div className={PAGE_CHROME.row}>
              <MobileTopBar />
              <div className={PAGE_CHROME.block}>
                {breadcrumb && <div className={PAGE_CHROME.phoneTrail}>{breadcrumb}</div>}
                <h1 className={PAGE_CHROME.title}>{title}</h1>
                {meta && (
                  <div className={cn(PAGE_CHROME.meta, breadcrumb && 'max-md:hidden')}>{meta}</div>
                )}
              </div>
              {actions && (
                <div className={cn(PAGE_CHROME.actions, split && 'max-md:hidden')}>{actions}</div>
              )}
              {pageIcons && <div className={PAGE_CHROME.pageIcons}>{pageIcons}</div>}
            </div>
          </div>
          {breadcrumb && meta && <div className={PAGE_CHROME.phoneMeta}>{meta}</div>}
          {actions && split && <div className={PAGE_CHROME.phoneActions}>{actions}</div>}
          {tabs && <div className={PAGE_CHROME.tabs}>{tabs}</div>}
        </header>
        {children}
      </div>
    );
  }
  const crumb =
    breadcrumb ?? (section ? <AppBreadcrumbs section={section} action={action} /> : null);
  return (
    <div className={cn('w-full min-w-0 space-y-4 pt-6 pb-6 text-sm', WIDTH[width], className)}>
      <ScrollRestorer />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 max-md:flex-nowrap max-md:gap-x-2">
        <MobileTopBar />
        {crumb && <div className="flex min-w-0 max-md:shrink-0">{crumb}</div>}
        {headerAside && (
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2 max-md:flex-nowrap md:ml-0 md:flex-1">
            {headerAside}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/** Form template footer: save state left, actions right; sticks to the bottom while the form scrolls. */
export function FormFooter({
  status,
  children,
  className,
}: {
  status?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(FORM_FOOTER.bar, className)}>
      {status && <div className={FORM_FOOTER.status}>{status}</div>}
      <div className={FORM_FOOTER.actions}>{children}</div>
    </div>
  );
}
