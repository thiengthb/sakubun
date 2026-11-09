'use client';

import * as React from 'react';
import { Select as SelectPrimitive } from '@base-ui/react/select';

import { cn } from '@/lib/core/utils';
import { FLOATING_GUTTER } from '@/components/ui/popover';
import { useFieldLabelId } from '@/components/common/field-label-context';
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from 'lucide-react';

// On Base UI. Two habits differ from Radix:
// - SelectValue shows the raw value unless it has children or the Select has `items` (value ->
//   label): the list's items are not mounted while it is shut, so their text cannot be read. A
//   select whose labels differ from its values passes one of the two.
// - The value is a string here, as it was. '' means nothing chosen (the placeholder shows), as on
//   Radix; Base UI's null for it never reaches callers.
function Select({
  value,
  defaultValue,
  onValueChange,
  ...props
}: Omit<SelectPrimitive.Root.Props<string>, 'value' | 'defaultValue' | 'onValueChange'> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}) {
  return (
    <SelectPrimitive.Root<string>
      data-slot="select"
      value={value === '' ? null : value}
      defaultValue={defaultValue === '' ? null : defaultValue}
      onValueChange={(next) => {
        if (next !== null) onValueChange?.(next);
      }}
      {...props}
    />
  );
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn('scroll-my-1 p-1.5', className)}
      {...props}
    />
  );
}

function SelectValue({ ...props }: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: 'sm' | 'default';
}) {
  const fieldLabelId = useFieldLabelId();
  const labelledBy = props['aria-labelledby'] ?? (props['aria-label'] ? undefined : fieldLabelId);
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      aria-labelledby={labelledBy}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-sm border-2 border-control-edge bg-card py-2 pr-2 pl-2.5 text-sm font-medium whitespace-nowrap shadow-lift transition-colors active:translate-y-0.5 active:shadow-none data-popup-open:translate-y-0.5 data-popup-open:shadow-none outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground mb-0.5 data-[size=default]:h-8.5 data-[size=sm]:h-6.5 md:data-[size=default]:h-6.5 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      {/* The chevron is the Icon's child: without one Base UI writes a ▼ character. */}
      <SelectPrimitive.Icon className="flex">
        <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

/**
 * `position="item-aligned"` (the default) lays the list over the trigger with the chosen item on
 * it; `"popper"` drops it below, at least as wide as the trigger. The names are Radix's.
 */
function SelectContent({
  className,
  children,
  position = 'item-aligned',
  side = 'bottom',
  sideOffset = 4,
  align = 'center',
  alignOffset = 0,
  collisionPadding = FLOATING_GUTTER,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset' | 'collisionPadding'
  > & { position?: 'item-aligned' | 'popper' }) {
  const alignItemWithTrigger = position === 'item-aligned';
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        data-floating=""
        side={side}
        sideOffset={alignItemWithTrigger ? 0 : sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        collisionPadding={collisionPadding}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            'relative z-50 max-h-(--available-height) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-xl border-2 border-border bg-popover text-popover-foreground shadow-lift-card duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            !alignItemWithTrigger && 'min-w-(--anchor-width)',
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

/** Must sit inside a SelectGroup. */
function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn('px-1.5 py-1 text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-lg py-2 pr-8 pl-2.5 text-sm font-medium outline-hidden md:py-1.5 select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('pointer-events-none -mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpArrow>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownArrow>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
