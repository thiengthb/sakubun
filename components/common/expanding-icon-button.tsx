'use client';

import * as React from 'react';
import { type LucideIcon } from 'lucide-react';
import { Slot } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/core/utils';

export function ExpandingIconButton({
  icon: Icon,
  label,
  badge,
  className,
  variant = 'outline',
  size = 'default',
  ref,
  children,
  ...props
}: React.ComponentProps<typeof Button> & {
  icon: LucideIcon;
  label: string;
  badge?: React.ReactNode;
}) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      aria-label={label}
      title={label}
      className={cn('gap-0', className)}
      {...props}
    >
      <Slot.Slottable>{children}</Slot.Slottable>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span
        aria-hidden
        className="max-md:hidden max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 ease-out group-hover/button:ml-1.5 group-hover/button:max-w-40 group-hover/button:opacity-100 group-focus-visible/button:ml-1.5 group-focus-visible/button:max-w-40 group-focus-visible/button:opacity-100 group-aria-[expanded=true]/button:ml-1.5 group-aria-[expanded=true]/button:max-w-40 group-aria-[expanded=true]/button:opacity-100 group-data-[collapsible=icon]:hidden motion-reduce:transition-none"
      >
        {label}
      </span>
      {badge != null && <span className="ml-1 shrink-0">{badge}</span>}
    </Button>
  );
}
