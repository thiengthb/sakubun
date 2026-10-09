'use client';

import { type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
    <Tooltip>
      <TooltipTrigger asChild>
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
