import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { FieldLabelContext } from '@/components/shared/field-label-context';
import { cn } from '@/lib/utils';
import { InfoTooltip } from '@/components/shared/info-tooltip';

/**
 * Shared Field for EVERY form: label + control + hint/info.
 * A control inside a `sm:grid-cols-2` grid is always `w-full` → cells are equal and fill the grid.
 * Uses <div> (not wrapping <label>) to avoid conflicts with Popover-style controls (DatePicker/TimePicker).
 *
 * Because it is not a <label>, the association has to be made explicitly. Auditing the rendered HTML
 * (2026-07-20) found every Radix Select trigger with NO accessible name at all — a screen-reader user
 * heard the current value ("Mọi cấp") with nothing saying which setting it belonged to.
 *
 * Two mechanisms, because one is not enough: the child is cloned with `aria-labelledby` (works for a
 * control that renders its own DOM node, e.g. Input), AND the id is published on context (for a
 * control whose outer element renders nothing — a Radix `Select` root swallows the cloned prop, which
 * is why cloning alone still measured 0 of 4 triggers named).
 */
export function Field({
  label,
  hint,
  info,
  className,
  children,
}: {
  label: ReactNode;
  /** Short note below the control */
  hint?: ReactNode;
  /** Long explanation → ⓘ icon next to the label (hover tooltip) */
  info?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const labelId = useId();

  // Only label a single element child, and never override a name the control already supplies.
  const labelled =
    isValidElement(children) &&
    !('aria-label' in (children.props as object)) &&
    !('aria-labelledby' in (children.props as object))
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          'aria-labelledby': labelId,
        })
      : children;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span id={labelId} className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {info && (
          <InfoTooltip label={typeof label === 'string' ? label : 'Giải thích'}>{info}</InfoTooltip>
        )}
      </span>
      <FieldLabelContext.Provider value={labelId}>{labelled}</FieldLabelContext.Provider>
      {/* No opacity modifier: muted-foreground is already dim, and /80 drops 12px hint text to
          3.46:1 — under the 4.5:1 AA floor. Plain muted-foreground measures 5.24:1. */}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
