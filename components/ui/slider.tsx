'use client';

import * as React from 'react';
import { Slider as SliderPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

function Slider({
  className,
  trackClassName,
  ticks,
  thumbLabel,
  valueText,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  /** Extra classes for the track — e.g. a thicker `h-3` (matches the JLPT level bars) for a prominent slider. */
  trackClassName?: string;
  /** Values (in the slider's own domain) to mark with a division line on the track, so notches read at a glance. */
  ticks?: number[];
  /**
   * Accessible name for the thumb — REQUIRED, and required on purpose. The thumb is the element that
   * carries `role="slider"`, so an unnamed thumb is announced as just a number with no idea what it
   * controls (axe `aria-input-field-name`; it fired on both settings sliders). Name the CONCEPT, not
   * the current value — the value is already announced via `aria-valuenow`. Pass an array for a
   * multi-thumb range.
   */
  thumbLabel: string | string[];
  /**
   * Human reading of the current value, for sliders whose NUMBER is not the value the user sees.
   *
   * The note above says "the value is already announced via `aria-valuenow`" — true for a scale that
   * means what it says (difficulty 3 of 5), and false for an INDEX. Measured on production 2026-08-12:
   * the «Cỡ câu» slider announces `aria-valuenow="1"` on a 0..6 scale, while the value the learner reads
   * under the thumb is «Ngắn» — so assistive tech gets a position where the screen shows a word. That is
   * exactly what `aria-valuetext` is for (WAI-ARIA: use it when the numeric value is not meaningful).
   *
   * Omit it whenever the number IS the value; a redundant valuetext just makes the announcement longer.
   */
  valueText?: (value: number) => string;
}) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        'relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          // Default height is a PLAIN `h-1` (not `data-horizontal:h-1`) so a plain `trackClassName`
          // like `h-3` can actually override it — a `data-*` variant has higher specificity and would
          // silently win, which is why an earlier `trackClassName="h-3"` had no visible effect.
          'relative grow overflow-hidden rounded-full bg-muted h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1',
          trackClassName,
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-primary select-none data-horizontal:h-full data-vertical:w-full"
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
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={Array.isArray(thumbLabel) ? (thumbLabel[index] ?? thumbLabel[0]) : thumbLabel}
          aria-valuetext={valueText ? valueText(_values[index]) : undefined}
          className="relative block size-4 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
