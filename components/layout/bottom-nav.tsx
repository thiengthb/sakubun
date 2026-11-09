'use client';

import { useEffect, useSyncExternalStore, type ComponentType } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/core/utils';

export interface BottomNavTab {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  /** A count on the tab (Ôn nhanh: the cards due); nothing shows at 0. */
  badge?: number;
  /** What the count means, read after the label by a screen reader. */
  badgeLabel?: (count: number) => string;
}

// UI v2, phase 1 (docs/plans/2026-11-08-ui-v2.md › Khung điều hướng): the phone's tab bar, after
// thienui's shells/bottom-nav with one change the plan asks for: every tab shows its name under
// the icon, since an icon alone is hard to guess. 56px tall plus the iPhone's safe area; from md the
// sidebar takes over. It steps aside while the keyboard is up and while a study session asks it
// to (<HideBottomNav />).
export function BottomNav({ tabs }: { tabs: readonly BottomNavTab[] }) {
  const typing = useSyncExternalStore(subscribeFocus, isTyping, () => false);
  const hidden = useSyncExternalStore(
    subscribeHide,
    () => hiders > 0,
    () => false,
  );
  if (typing || hidden) return null;

  return (
    <nav
      aria-label="Điều hướng chính"
      data-bottom-nav=""
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex h-14 max-w-md">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count = tab.badge ?? 0;
          return (
            <li key={tab.href} className="min-w-0 flex-1">
              <Link
                href={tab.href}
                aria-current={tab.active ? 'page' : undefined}
                className={cn(
                  'group/tab flex h-full flex-col items-center justify-center gap-0.5 text-caption2 font-medium text-muted-foreground outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset',
                  tab.active && 'text-accent-brand',
                )}
              >
                <span
                  className={cn(
                    'relative flex h-7 w-12 items-center justify-center rounded-lg border-2 border-transparent transition-colors group-active/tab:translate-y-0.5',
                    tab.active && 'border-border bg-card shadow-lift-card',
                  )}
                >
                  <Icon className="size-4" />
                  {count > 0 && (
                    <span
                      aria-hidden
                      data-badge=""
                      className="absolute -top-1.5 left-1/2 ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-caption2 leading-none font-semibold text-primary-foreground tabular-nums"
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate px-0.5">{tab.label}</span>
                {count > 0 && tab.badgeLabel && (
                  <span className="sr-only">, {tab.badgeLabel(count)}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// The keyboard is up while focus sits in a place that types text.
const NOT_TEXT = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

function isTyping(): boolean {
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !NOT_TEXT.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

function subscribeFocus(onChange: () => void): () => void {
  document.addEventListener('focusin', onChange);
  document.addEventListener('focusout', onChange);
  return () => {
    document.removeEventListener('focusin', onChange);
    document.removeEventListener('focusout', onChange);
  };
}

let hiders = 0;
const hideListeners = new Set<() => void>();

function subscribeHide(onChange: () => void): () => void {
  hideListeners.add(onChange);
  return () => hideListeners.delete(onChange);
}

/** Rendered by a study session: the tab bar steps aside while it is on the page. */
export function HideBottomNav() {
  useEffect(() => {
    hiders++;
    hideListeners.forEach((l) => l());
    return () => {
      hiders--;
      hideListeners.forEach((l) => l());
    };
  }, []);
  return null;
}
