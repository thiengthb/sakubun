'use client';

import * as React from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';

import { cn } from '@/lib/core/utils';

// Duolingo's switch (thien, 2026-10-25): a thick track with the 2px control edge and a lip under
// it, a plain white knob with its own edge; on, the track takes the primary colour.
// `brandKnob`: the knob is primary while off, for a switch whose off side is a choice too (the
// theme switch: off is light mode, and a white knob there read as disabled, thien round 2).
function Switch({
  className,
  size = 'default',
  brandKnob = false,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'default';
  brandKnob?: boolean;
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        'peer group/switch relative mb-0.5 inline-flex shrink-0 items-center rounded-full border-2 transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-7 data-[size=default]:w-12 data-[size=sm]:h-6 data-[size=sm]:w-10 data-checked:border-press data-checked:bg-primary data-checked:shadow-lift-primary data-unchecked:border-control-edge data-unchecked:bg-muted data-unchecked:shadow-lift data-disabled:cursor-not-allowed data-disabled:opacity-50 motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none ml-0.5 block rounded-full border-2 bg-white transition-transform duration-200 ease-(--ease-overshoot) group-data-[size=default]/switch:size-5 group-data-[size=sm]/switch:size-4 data-checked:border-press data-unchecked:border-control-edge group-data-[size=default]/switch:data-checked:translate-x-5 group-data-[size=sm]/switch:data-checked:translate-x-4 data-unchecked:translate-x-0 motion-reduce:transition-none',
          brandKnob && 'data-unchecked:border-press data-unchecked:bg-primary',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
