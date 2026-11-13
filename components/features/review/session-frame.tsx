import { type ReactNode } from 'react';
import { cn } from '@/lib/core/utils';
import { PAGE_CHROME } from '@/components/layout/page-chrome';

// UI v2, phase 2 (docs/plans/2026-11-13-u2-study-session.md, U2a): a study session's page. While a
// session runs the app's way-finding steps aside (StudyFocus), so the header starts with the way
// out, an X, where other pages have the phone's logo; the title and the count of cards left follow;
// the end of the row is kept for the session's own actions. Under it, the progress bar. The column
// is 640px on a laptop: a card and its four answers read as one, and a line of text stays short.
// The loading screen draws the same frame, so nothing moves when the cards arrive.
export const SESSION_COLUMN = 'mx-auto max-w-160';

export function SessionFrame({
  close,
  meta,
  aside,
  progress,
  children,
}: {
  /** The way out (Dừng ôn) or its placeholder; once over, the phone's logo as on other pages. */
  close?: ReactNode;
  /** The count of cards left, under the title. */
  meta?: ReactNode;
  /** End of the title's row: the session's own actions. */
  aside?: ReactNode;
  progress: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cn(PAGE_CHROME.page, SESSION_COLUMN)} data-template="form">
      <header className={PAGE_CHROME.header}>
        <div className={PAGE_CHROME.row}>
          {close}
          <div className={PAGE_CHROME.block}>
            <h1 className={PAGE_CHROME.title}>Ôn nhanh</h1>
            {meta && <div className={PAGE_CHROME.meta}>{meta}</div>}
          </div>
          {aside && <div className={PAGE_CHROME.actions}>{aside}</div>}
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
