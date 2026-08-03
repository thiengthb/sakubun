'use client';

import { type ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Wrap an element so IT explains itself on hover, focus and touch.
 *
 * The one sanctioned way to attach an explanation to existing content — locked as
 * `explain-is-the-only-tooltip` in `docs/ui-patterns.json`. Two mechanisms had grown side by side
 * (26 sites): the browser's native `title=` and hand-rolled `Tooltip*` primitives.
 *
 * Native `title=` loses three ways, and the third one matters most here: it never appears on a touch
 * device (so on a phone the explanation simply does not exist), it is drawn by the OS so it ignores the
 * theme entirely, and its ~1s delay cannot be tuned. It reads cheap because it is one attribute — but
 * the cost lands on the person holding the phone, not on the author.
 *
 * The sibling components, so the right one gets picked:
 *  - `Explain` (here)      — existing content explains ITSELF. No new affordance, no layout change.
 *  - `InfoTooltip`         — adds a circle-i BUTTON next to something. Use when there is no element to
 *                            wrap, or when the explanation is about a whole section rather than a control.
 *
 * `asChild` means no wrapper element is inserted: the child keeps its own layout, so wrapping a flex
 * item does not break the row. The child must therefore accept a ref and spread props — a DOM element
 * or a component built with them (all of shadcn's are).
 */
export function Explain({
  children,
  text,
  side = 'top',
  align,
  className,
  onOpenChange,
}: {
  /** The element being explained — receives the trigger props directly (`asChild`). */
  children: ReactNode;
  /** What it is, what it does, where a number comes from. Written for someone seeing it the tenth time. */
  text: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Bubble alignment along `side` — 'end' keeps a wide panel inside the viewport near an edge. */
  align?: 'start' | 'center' | 'end';
  /** Extra classes for the bubble, not the trigger. */
  className?: string;
  /** Fires when the bubble opens/closes — for a hint that marks itself read once actually seen. */
  onOpenChange?: (open: boolean) => void;
}) {
  // An element with nothing to say renders unchanged rather than as an empty bubble, so a caller may
  // pass a possibly-null description without branching at every call site.
  if (!text) return <>{children}</>;
  return (
    <Tooltip onOpenChange={onOpenChange}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        className={`max-w-xs text-left leading-relaxed break-words whitespace-normal ${className ?? ''}`}
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
