import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { FieldLabelContext } from '@/components/common/field-label-context';
import { cn } from '@/lib/core/utils';
import { InfoTooltip } from '@/components/common/info-tooltip';

// A form field (docs/ui-standard.md › Form): a bold label, a red * when the field is required (the
// form's RequiredNote explains the mark), and the error under the control once the form is sent.
export function Field({
  label,
  hint,
  info,
  required = false,
  error,
  count,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  info?: ReactNode;
  required?: boolean;
  /** Shown under the control in place of the hint; marks the control invalid. */
  error?: string | null;
  /** A length limit: "12/40" at the end of the hint row, red once over. */
  count?: { value: number; max: number };
  className?: string;
  children: ReactNode;
}) {
  const labelId = useId();
  const errorId = useId();

  const labelled =
    isValidElement(children) &&
    !('aria-label' in (children.props as object)) &&
    !('aria-labelledby' in (children.props as object))
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          'aria-labelledby': labelId,
          ...(required && { 'aria-required': true }),
          ...(error && { 'aria-invalid': true, 'aria-describedby': errorId }),
        })
      : children;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span id={labelId} className="flex items-center gap-1 text-sm font-bold text-foreground">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
        {info && (
          <InfoTooltip label={typeof label === 'string' ? label : 'Giải thích'}>{info}</InfoTooltip>
        )}
      </span>
      <FieldLabelContext.Provider value={labelId}>{labelled}</FieldLabelContext.Provider>
      {(error || hint || count) && (
        <div className="flex items-start gap-3">
          {error ? (
            <span id={errorId} className="text-xs font-semibold text-destructive">
              {error}
            </span>
          ) : (
            hint && <span className="text-xs text-muted-foreground">{hint}</span>
          )}
          {count && (
            <span
              className={cn(
                'ml-auto text-xs text-muted-foreground tabular-nums',
                count.value > count.max && 'font-semibold text-destructive',
              )}
            >
              {count.value}/{count.max}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Under a form with required fields: what the red * means. */
export function RequiredNote({ className }: { className?: string }) {
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      Ô có{' '}
      <span className="font-bold text-destructive" aria-hidden>
        *
      </span>
      <span className="sr-only">dấu sao</span> là bắt buộc.
    </p>
  );
}

/** A form's last row: the required note on the left, the actions on the right (shared equally on a phone). */
export function FormActions({
  note = true,
  className,
  children,
}: {
  note?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 pt-2', className)}>
      {note && <RequiredNote />}
      <div className="ml-auto flex gap-2 max-sm:w-full max-sm:[&>*]:flex-1">{children}</div>
    </div>
  );
}
