import { type ReactNode } from 'react';
import { MobileTopBar } from '@/components/layout/mobile-top-bar';
import { DETAIL_CHROME, PAGE_CHROME } from '@/components/layout/page-chrome';
import { cn } from '@/lib/core/utils';

export interface HeaderFact {
  label: string;
  value: ReactNode;
  /** Text colour of the value, e.g. the state's colour. */
  tone?: string;
}

/** PageShell's header when a template page passes `facts` (docs/ui-standard.md › Đầu trang). */
export function DetailHeader({
  breadcrumb,
  title,
  subtitle,
  facts,
  actions,
  pageIcons,
  tabs,
}: {
  breadcrumb?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  facts: HeaderFact[];
  actions?: ReactNode;
  pageIcons?: ReactNode;
  tabs?: ReactNode;
}) {
  return (
    <header className={DETAIL_CHROME.header}>
      <div className={DETAIL_CHROME.head}>
        <div className={DETAIL_CHROME.phoneTop}>
          <MobileTopBar />
          <div className={DETAIL_CHROME.phoneTrail}>{breadcrumb}</div>
          {pageIcons && <div className={PAGE_CHROME.pageIcons}>{pageIcons}</div>}
        </div>
        <div className={PAGE_CHROME.trail}>{breadcrumb}</div>
        <div className={DETAIL_CHROME.titleRow}>
          <div className={DETAIL_CHROME.titleBlock}>
            <h1 className={DETAIL_CHROME.title}>{title}</h1>
            {subtitle && <div className={DETAIL_CHROME.subtitle}>{subtitle}</div>}
          </div>
          {(actions || pageIcons) && (
            <div className={DETAIL_CHROME.side}>
              {actions}
              {pageIcons}
            </div>
          )}
        </div>
        {facts.length > 0 && (
          <dl className={DETAIL_CHROME.facts}>
            {facts.map((f) => (
              <div key={f.label} className={DETAIL_CHROME.fact}>
                <dt className={DETAIL_CHROME.factLabel}>{f.label}</dt>
                <dd className={cn(DETAIL_CHROME.factValue, f.tone)}>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {actions && <div className={PAGE_CHROME.phoneActions}>{actions}</div>}
      {tabs && <div className={PAGE_CHROME.tabs}>{tabs}</div>}
    </header>
  );
}
