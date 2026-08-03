'use client';

import { type ReactNode, useReducer, useSyncExternalStore } from 'react';
import { Lightbulb } from 'lucide-react';
import { Explain } from '@/components/shared/explain';
import { cn } from '@/lib/utils';

const emptySubscribe = () => () => {};

/**
 * A lightbulb "hint" button that reveals a short intro/guide on hover or keyboard focus. It GLOWS
 * (pulsing, brand colour) until the user has seen it once, then settles to a normal muted icon —
 * "read" is remembered in localStorage under `storageKey`, so it draws a first-time visitor's eye
 * without nagging afterwards. Sits at the end of a tab row (pass `className="ml-auto"`).
 */
export function IntroHint({
  children,
  storageKey,
  label = 'Giới thiệu nhanh',
  side = 'bottom',
  className,
}: {
  children: ReactNode;
  /** localStorage key that remembers whether this hint has been seen. */
  storageKey: string;
  label?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}) {
  const key = `sakubun.hint-read.${storageKey}`;
  const [, bump] = useReducer((n: number) => n + 1, 0);

  // useSyncExternalStore reads localStorage client-side while giving a stable server snapshot of
  // "read" (no glow) — so SSR + hydration match and a first-timer flips to glowing after mount,
  // with no setState-in-effect. `bump()` forces a re-read after markRead flips the flag.
  const read = useSyncExternalStore(
    emptySubscribe,
    () => {
      try {
        return localStorage.getItem(key) === '1';
      } catch {
        return true; // localStorage unavailable (private mode) → treat as read, no glow
      }
    },
    () => true,
  );

  const markRead = () => {
    if (read) return;
    try {
      localStorage.setItem(key, '1');
    } catch {
      // ignore — the glow just returns next reload, which is harmless.
    }
    bump();
  };

  return (
    <Explain
      onOpenChange={(open) => open && markRead()}
      text={children}
      side={side}
      className="max-w-sm space-y-2"
    >
      <button
        type="button"
        aria-label={label}
        className={cn(
          'inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent transition-colors',
          read
            ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
            : 'animate-pulse border-primary/30 bg-primary/10 text-primary motion-reduce:animate-none',
          className,
        )}
      >
        <Lightbulb className="size-4" />
      </button>
    </Explain>
  );
}
