import { type ReactNode } from 'react';
import { cn } from '@/lib/core/utils';
import { PAGE_CHROME } from '@/components/layout/page-chrome';
import { MobileTopBar } from '@/components/layout/mobile-top-bar';

// UI v2, phase 2 (docs/plans/2026-11-13-u2-study-session.md, U2a): a study session's page. It keeps
// the frame every other page has (thien, 2026-11-13): the sidebar on a laptop, the tab bar on a
// phone, the same width, and the same header row, with the phone's logo at the start and the
// session's way out (an X) at the end. Under the header, the progress bar. The loading screen draws
// the same frame, so nothing moves when the cards arrive.
export function SessionFrame({
  meta,
  actions,
  progress,
  children,
}: {
  /** The count of cards left, under the title. */
  meta?: ReactNode;
  /** End of the title's row: the way out (Dừng ôn) or its placeholder. */
  actions?: ReactNode;
  progress: ReactNode;
  children: ReactNode;
}) {
  return (
    // Phone: the session's bar rests right on the tab bar, as the U2 screens thien approved show
    // it; the page's usual bottom padding would leave a gap there (useFillWindow reads it).
    <div className={cn(PAGE_CHROME.page, 'max-md:pb-0')} data-template="form">
      <header className={PAGE_CHROME.header}>
        <div className={PAGE_CHROME.row}>
          <MobileTopBar />
          <div className={PAGE_CHROME.block}>
            <h1 className={PAGE_CHROME.title}>Ôn nhanh</h1>
            {meta && <div className={PAGE_CHROME.meta}>{meta}</div>}
          </div>
          {actions && <div className={PAGE_CHROME.actions}>{actions}</div>}
        </div>
        {progress}
      </header>
      {children}
    </div>
  );
}

export type Step = 'right' | 'wrong' | 'current' | 'todo';

/**
 * The session's progress, one segment a card: green remembered, red missed, the brand colour for
 * the card on screen. A progressbar for a screen reader, named "Thẻ 3 / 10".
 */
export function SessionProgress({ steps, label }: { steps: Step[]; label: string }) {
  const done = steps.filter((s) => s === 'right' || s === 'wrong').length;
  return (
    <div
      className="flex gap-1.5"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={steps.length}
      aria-valuenow={done}
    >
      {steps.map((step, i) => (
        <div
          key={i}
          className={cn(
            'h-2 flex-1 rounded-full bg-muted',
            step === 'right' && 'bg-ok',
            step === 'wrong' && 'bg-destructive',
            step === 'current' && 'bg-accent-brand',
          )}
        />
      ))}
    </div>
  );
}

/**
 * Layout C's side panel (thien, 2026-11-13): from 1280px only, beside the card, staying in view while
 * the card scrolls. The counts of the round so far, then whatever the session puts under them (the
 * keys for the step on screen).
 */
export function SessionPanel({
  remembered,
  missed,
  left,
  children,
}: {
  remembered: number;
  missed: number;
  left: number;
  children?: ReactNode;
}) {
  const counts: [string, number, string?][] = [
    ['Nhớ', remembered, 'text-ok'],
    ['Chưa nhớ', missed, 'text-destructive'],
    ['Còn', left],
  ];
  return (
    <aside
      aria-label="Buổi ôn này"
      className="sticky top-6 space-y-4 self-start rounded-lg border border-border bg-card p-4 max-xl:hidden"
    >
      <dl className="grid grid-cols-3 gap-2 text-center">
        {counts.map(([label, n, tone]) => (
          <div key={label} className="flex flex-col-reverse">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={cn('text-title tabular-nums', tone)}>{n}</dd>
          </div>
        ))}
      </dl>
      {children}
    </aside>
  );
}
