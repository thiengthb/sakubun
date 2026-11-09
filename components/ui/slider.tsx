'use client';

import { Slider as SliderPrimitive } from '@base-ui/react/slider';

import { cn } from '@/lib/core/utils';

// A range of one or more thumbs, so the value is always an array. Base UI puts the role on an input
// inside each thumb, which takes its name from `thumbLabel`.
function Slider({
  className,
  trackClassName,
  ticks,
  thumbLabel,
  valueText,
  defaultValue,
  value,
  onValueChange,
  min = 0,
  max = 100,
  ...props
}: Omit<SliderPrimitive.Root.Props<number[]>, 'onValueChange'> & {
  onValueChange?: (value: number[]) => void;
  trackClassName?: string;
  ticks?: number[];
  thumbLabel: string | string[];
  valueText?: (value: number) => string;
}) {
  const count = (value ?? defaultValue ?? [min, max]).length;

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      onValueChange={(next) => onValueChange?.(Array.isArray(next) ? [...next] : [next])}
      min={min}
      max={max}
      thumbAlignment="edge"
      className={cn('w-full', className)}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className={cn(
            'relative h-1 w-full grow overflow-hidden rounded-full bg-muted',
            trackClassName,
          )}
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="h-full bg-primary select-none"
          />
          {ticks?.map((t) => (
            <span
              key={t}
              aria-hidden
              className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-background/90"
              style={{ left: `${((t - min) / (max - min)) * 100}%` }}
            />
          ))}
        </SliderPrimitive.Track>
        {Array.from({ length: count }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            index={index}
            getAriaLabel={() =>
              Array.isArray(thumbLabel) ? (thumbLabel[index] ?? thumbLabel[0]) : thumbLabel
            }
            getAriaValueText={valueText ? (_, v) => valueText(v) : undefined}
            className="relative block size-4 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 has-focus-visible:ring-3 data-disabled:pointer-events-none data-disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
