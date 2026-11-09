'use client';

import { Separator as SeparatorPrimitive } from '@base-ui/react/separator';

import { cn } from '@/lib/core/utils';

function Separator({ className, orientation = 'horizontal', ...props }: SeparatorPrimitive.Props) {
  return (
    // Decorative by default, as Radix was: a screen reader skips it unless the caller sets a role.
    <SeparatorPrimitive
      data-slot="separator"
      role="presentation"
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch',
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
