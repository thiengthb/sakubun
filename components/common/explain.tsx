'use client';

import { type ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function Explain({
  children,
  text,
  side = 'top',
  align,
  className,
  onOpenChange,
}: {
  children: ReactNode;
  text: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
  onOpenChange?: (open: boolean) => void;
}) {
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
