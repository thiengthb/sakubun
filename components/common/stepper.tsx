'use client';

import { useState, type KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/core/utils';
import { parseStepperInput, stepValue } from '@/lib/settings/stepper';

// −  value  +  for a bounded whole number. The middle is the shared Input (no clear button) so the value can also be
// typed (and so getByLabel finds it); a partial entry is held as a draft until it is a valid value,
// and blur drops whatever never became one.
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  suffix,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  suffix?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const bounds = { min, max };
  const nudge = (delta: number) => {
    setDraft(null);
    onChange(stepValue(value, delta, bounds));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      nudge(e.key === 'ArrowUp' ? step : -step);
    }
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex h-8 shrink-0 items-center rounded-lg border border-input transition-shadow has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50',
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Giảm ${label}`}
        disabled={value <= min}
        onClick={() => nudge(-step)}
        className="rounded-r-none"
      >
        <Minus />
      </Button>
      <label className="flex h-full items-center justify-center gap-0.5 px-1">
        <Input
          type="text"
          inputMode="numeric"
          clearable={false}
          aria-label={label}
          value={draft ?? String(value)}
          onChange={(e) => {
            setDraft(e.target.value);
            const next = parseStepperInput(e.target.value, bounds);
            if (next !== null) onChange(next);
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={onKeyDown}
          wrapperClassName={cn('h-full', suffix ? 'w-7' : 'w-10')}
          className="h-full rounded-none border-0 bg-transparent px-0 text-center text-body font-semibold tabular-nums focus-visible:ring-0 md:text-body dark:bg-transparent"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </label>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Tăng ${label}`}
        disabled={value >= max}
        onClick={() => nudge(step)}
        className="rounded-l-none"
      >
        <Plus />
      </Button>
    </div>
  );
}
