import { type ReactNode } from 'react';
import { cn } from '@/lib/core/utils';
import {
  AppBreadcrumbs,
  type BreadcrumbAction,
  type BreadcrumbSection,
} from '@/components/layout/app-breadcrumbs';
import { MobileTopBar } from '@/components/layout/mobile-top-bar';
import { ScrollRestorer } from '@/components/layout/scroll-restorer';

type PageWidth = 'full' | 'wide' | 'narrow' | 'form';

const WIDTH: Record<PageWidth, string> = {
  full: '',
  wide: 'mx-auto max-w-5xl',
  narrow: 'mx-auto max-w-3xl',
  form: 'mx-auto max-w-2xl',
};

interface PageShellProps {
  children: ReactNode;
  section?: BreadcrumbSection;
  action?: BreadcrumbAction;
  breadcrumb?: ReactNode;
  headerAside?: ReactNode;
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
