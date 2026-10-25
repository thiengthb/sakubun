'use client';

import * as React from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Explain } from '@/components/common/explain';
import { cn } from '@/lib/core/utils';

export function BulkActionButton({
  icon: Icon,
  label,
  pendingLabel,
  pending = false,
  side = 'left',
  variant = 'outline',
  // 36px at every width: the bar's buttons are its only targets, and 28px was hard to hit.
  size = 'icon-lg',
  className,
  disabled,
  ref,
  ...props
}: React.ComponentProps<typeof Button> & {
  icon: LucideIcon;
  label: string;
  pendingLabel?: string;
  pending?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  const name = pending ? (pendingLabel ?? label) : label;

  return (
    <Explain side={side} text={name}>
      <Button
        ref={ref}
        variant={variant}
        size={size}
        aria-label={name}
        disabled={disabled || pending}
        className={cn(className)}
        {...props}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <Icon className="size-4" aria-hidden />
        )}
      </Button>
    </Explain>
  );
}
