'use client';

import { type ReactElement, type ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/core/utils';

export function Explain({
  children,
  text,
  side = 'top',
  align,
  className,
  onOpenChange,
}: {
  children: ReactElement;
  text: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  if (!text) return children;
  return (
    <Tooltip onOpenChange={onOpenChange}>
      <TooltipTrigger render={children} />
      <TooltipContent
        side={side}
        align={align}
        className={cn(
          'max-w-xs text-left leading-relaxed break-words whitespace-normal',
          className,
        )}
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
