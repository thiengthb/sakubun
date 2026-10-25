'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Toggle as TogglePrimitive } from 'radix-ui';

import { cn } from '@/lib/core/utils';

// thienui registry/base/toggle.tsx, on Radix until components/ui moves to Base UI. Radix marks a
// pressed toggle with data-state="on" (Base UI uses aria-pressed), so both selectors stay.
const toggleVariants = cva(
  "target-44 group/toggle inline-flex items-center justify-center gap-1 rounded-sm text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted data-[state=on]:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border border-input bg-transparent hover:bg-muted',
        choice:
          'border-2 border-control-edge bg-card text-muted-foreground shadow-lift active:translate-y-0.5 active:shadow-none data-[state=on]:border-brand-wash data-[state=on]:bg-brand-wash data-[state=on]:text-accent-brand data-[state=on]:shadow-lift-chosen',
      },
      size: {
        default: 'h-9 min-w-9 px-2.5 md:h-7 md:min-w-7',
        sm: "h-7 min-w-7 px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 min-w-9 px-2.5',
      },
    },
    // The choice chip's 2px lip counts toward its height, like a raised Button's.
    compoundVariants: [
      { variant: 'choice', size: 'default', class: 'mb-0.5 h-8.5 md:h-6.5' },
      { variant: 'choice', size: 'sm', class: 'mb-0.5 h-6.5' },
      { variant: 'choice', size: 'lg', class: 'mb-0.5 h-8.5' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

/**
 * A choice chip driven by aria-pressed instead of Radix state: the same look as the `choice` variant.
 * The caller sets a height 2px short of the row's; the margin keeps the lip's 2px free below.
 */
function choiceChipClass(on: boolean) {
  return on
    ? 'mb-0.5 border-2 border-brand-wash bg-brand-wash text-accent-brand shadow-lift-chosen active:translate-y-0.5 active:shadow-none'
    : 'mb-0.5 border-2 border-control-edge bg-card text-muted-foreground shadow-lift hover:text-foreground active:translate-y-0.5 active:shadow-none';
}

export { Toggle, toggleVariants, choiceChipClass };
