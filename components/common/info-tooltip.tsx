'use client';

import { useState, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/core/utils';

// A tooltip that a tap also opens. Radix Tooltip opens on hover and keyboard focus only, and its
// trigger CLOSES it on click — so on a phone an explanation behind it could never be read. Here a
// click opens it (and stops Radix from closing it); a tap outside closes it as before.
export function TapTooltip({
  content,
  children,
  side = 'top',
  className,
}: {
  content: ReactNode;
  children: ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        asChild
        onClick={(e: MouseEvent) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className={cn(
          'max-w-xs text-left leading-relaxed break-words whitespace-normal line-clamp-6',
          className,
        )}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export function InfoTooltip({
  children,
  label = 'Giải thích',
  className,
  side = 'top',
}: {
  children: ReactNode;
  label?: string;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  return (
    <TapTooltip content={children} side={side}>
      <button
        type="button"
        aria-label={label}
        className={cn(
          'inline-flex size-6 shrink-0 -m-1 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:text-foreground',
          className,
        )}
      >
        <Info className="size-3.5" />
      </button>
    </TapTooltip>
  );
}
