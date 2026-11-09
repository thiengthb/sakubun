'use client';

import * as React from 'react';
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';

import { cn } from '@/lib/core/utils';

function TooltipProvider({ delay = 0, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />;
}

// Base UI's tooltip is visual only: no role="tooltip", nothing ties it to its trigger. sakubun's
// tooltips explain (Explain, InfoTooltip), so a screen reader must hear them too: while it is
// open the content is a role="tooltip" and the trigger is aria-describedby it, as with Radix.
const TooltipA11y = React.createContext<{ id: string; open: boolean } | null>(null);

function Tooltip({ open: controlled, onOpenChange, ...props }: TooltipPrimitive.Root.Props) {
  const id = React.useId();
  const [uncontrolled, setUncontrolled] = React.useState(false);
  const open = controlled ?? uncontrolled;
  return (
    <TooltipA11y.Provider value={{ id, open }}>
      <TooltipPrimitive.Root
        data-slot="tooltip"
        open={controlled}
        onOpenChange={(next, details) => {
          setUncontrolled(next);
          onOpenChange?.(next, details);
        }}
        {...props}
      />
    </TooltipA11y.Provider>
  );
}

// The element it explains goes in `render` (Base UI's slot; Radix called it asChild).
function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  const a11y = React.useContext(TooltipA11y);
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      aria-describedby={a11y?.open ? a11y.id : undefined}
      {...props}
    />
  );
}

function TooltipContent({
  className,
  side = 'top',
  align = 'center',
  sideOffset = 0,
  collisionPadding = 8,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, 'align' | 'side' | 'sideOffset' | 'collisionPadding'>) {
  const a11y = React.useContext(TooltipA11y);
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        data-floating=""
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          id={a11y?.id}
          role="tooltip"
          className={cn(
            'z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
