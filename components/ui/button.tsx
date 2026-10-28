import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/core/utils';

// Variants with a lip under the face (shadow-lift*).
const LIFTED: ('default' | 'outline' | 'destructive')[] = ['default', 'outline', 'destructive'];

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-sm border-2 border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Raised: a 2px lift that the press takes away.
        default:
          'bg-primary text-primary-foreground shadow-lift-primary hover:bg-primary/90 active:not-aria-[haspopup]:translate-y-0.5 active:not-aria-[haspopup]:shadow-none',
        outline:
          'border-control-edge bg-card shadow-lift hover:bg-muted hover:text-foreground active:not-aria-[haspopup]:translate-y-0.5 active:not-aria-[haspopup]:shadow-none aria-expanded:bg-muted aria-expanded:text-foreground',
        // A suggestion to create the first of something: flat, dashed edge.
        dashed:
          'border-dashed border-control-edge text-muted-foreground hover:border-primary hover:text-accent-brand',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
        ghost:
          'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
        destructive:
          'bg-destructive text-destructive-foreground shadow-lift-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 active:not-aria-[haspopup]:translate-y-0.5 active:not-aria-[haspopup]:shadow-none dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // 36px on a phone, 28px from 768px (docs/ui-standard.md).
        default:
          'h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 md:h-7 md:px-2.5',
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-10 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 md:h-8 md:px-2.5',
        icon: 'size-9 md:size-7',
        // A content action (IconAction): icon and word on a phone, the icon alone, square, from 768px.
        'icon-word': 'h-9 gap-1.5 px-3 md:size-7 md:px-0',
        'icon-xs':
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm':
          'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg',
        'icon-lg': 'size-9',
        // Fills the height of a framed control (the stepper's − and +), square.
        'icon-fill': 'aspect-square h-full',
      },
    },
    // A raised button's 2px lip counts toward its height, so it is as tall as a flat field beside
    // it: the box gives the lip 2px, kept free below by a margin (docs/ui-standard.md).
    compoundVariants: [
      { variant: LIFTED, size: 'default', class: 'mb-0.5 h-8.5 md:h-6.5' },
      { variant: LIFTED, size: 'xs', class: 'mb-0.5 h-5.5' },
      { variant: LIFTED, size: 'sm', class: 'mb-0.5 h-6.5' },
      { variant: LIFTED, size: 'lg', class: 'mb-0.5 h-9.5 md:h-7.5' },
      { variant: LIFTED, size: 'icon', class: 'mb-0.5 h-8.5 md:h-6.5' },
      { variant: LIFTED, size: 'icon-xs', class: 'mb-0.5 h-5.5' },
      { variant: LIFTED, size: 'icon-sm', class: 'mb-0.5 h-6.5' },
      { variant: LIFTED, size: 'icon-lg', class: 'mb-0.5 h-8.5' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
