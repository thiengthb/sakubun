import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { FieldLabelContext } from '@/components/common/field-label-context';
import { cn } from '@/lib/core/utils';
import { InfoTooltip } from '@/components/common/info-tooltip';

export function Field({
  label,
  hint,
  info,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  info?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const labelId = useId();

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
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
