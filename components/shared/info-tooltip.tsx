'use client';

import { type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * ⓘ icon that reveals a description in a HOVER/FOCUS tooltip — the minimal-UI alternative to an
 * always-visible description line under a title/label. The tooltip wraps long text and clamps it to
 * a few lines so it never grows into a wall. Opens on hover AND keyboard focus (Radix), so it stays
 * reachable without a pointer. For long rich content / touch-first surfaces prefer the click-Popover
 * variant `info-hint` instead.
 */
export function InfoTooltip({
  children,
  label = 'Giải thích',
  className,
  side = 'top',
}: {
  children: ReactNode;
  /** Accessible name for the trigger (defaults to a generic label). */
  label?: string;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            // 24px hit area, 14px icon, and -m-1 so the surrounding layout still reserves only the
            // old 16px box — the row height and label gap are unchanged. A bare size-4 trigger was
            // 16x16 and failed WCAG 2.2 SC 2.5.8 on every settings row at once, since this one
            // component supplies every Field's ⓘ.
            'inline-flex size-6 shrink-0 -m-1 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:text-foreground',
            className,
          )}
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="max-w-xs text-left leading-relaxed break-words whitespace-normal line-clamp-6"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
