'use client';

import { Explain } from '@/components/common/explain';
import { cn } from '@/lib/core/utils';
import { formatDateTimeVN, formatDueExact, humanizeAgo, humanizeUntil } from '@/lib/core/format';

export function RelativeTime({
  value,
  className,
}: {
  value: string | number | Date;
  className?: string;
}) {
  const date = new Date(value);
  return (
    <Explain text={formatDateTimeVN(date)}>
      <span className={cn('cursor-default', className)} suppressHydrationWarning>
        {humanizeAgo(date)}
      </span>
    </Explain>
  );
}

export function DueTime({
  value,
  className,
}: {
  value: string | number | Date;
  className?: string;
}) {
  const date = new Date(value);
  return (
    <Explain text={formatDueExact(date)}>
      <span className={cn('cursor-default tabular-nums', className)} suppressHydrationWarning>
        {humanizeUntil(date)}
      </span>
    </Explain>
  );
}
