'use client';

import * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';

import { cn } from '@/lib/core/utils';
import { toggleVariants } from '@/components/ui/toggle';

// A row of chips where exactly one is chosen. thienui builds it on Base UI's ToggleGroup, which is a
// group of pressed buttons; sakubun keeps what Radix gave it, a radiogroup of radios (the e2e and a
// screen reader find the choice by role="radio" and aria-checked). So it sits on Base UI's
// RadioGroup, each radio a real <button>. Arrow keys move and choose, as radios do; a chosen chip
// cannot be cleared by clicking it again.
const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants>>({
  size: 'default',
  variant: 'default',
});

function ToggleGroup({
  className,
  variant,
  size,
  children,
  value,
  defaultValue,
  onValueChange,
  type: _type,
  ...props
}: Omit<RadioGroupPrimitive.Props<string>, 'value' | 'defaultValue' | 'onValueChange'> &
  VariantProps<typeof toggleVariants> & {
    /** Radix's name for a single-choice group; the only kind sakubun uses. */
    type?: 'single';
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
  }) {
  return (
    <RadioGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => onValueChange?.(next as string)}
      className={cn(
        'group/toggle-group flex w-fit items-center gap-0.5 rounded-sm data-[variant=choice]:gap-1.5',
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </RadioGroupPrimitive>
  );
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  value,
  ...props
}: Omit<RadioPrimitive.Root.Props<string>, 'value' | 'nativeButton' | 'render'> &
  VariantProps<typeof toggleVariants> & { value: string }) {
  const context = React.useContext(ToggleGroupContext);

  return (
    <RadioPrimitive.Root
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      value={value}
      nativeButton
      render={<button type="button" />}
      className={cn(
        'shrink-0 focus:z-10 focus-visible:z-10',
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </RadioPrimitive.Root>
  );
}

export { ToggleGroup, ToggleGroupItem };
