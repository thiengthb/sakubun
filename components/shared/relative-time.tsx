'use client';

import { Explain } from '@/components/shared/explain';
import { cn } from '@/lib/utils';
import { formatDateTimeVN, formatDueExact, humanizeAgo, humanizeUntil } from '@/lib/format';

/**
 * A past timestamp shown as "x giây/phút/giờ/ngày trước" (humanizeAgo) with the exact date + time
 * (formatDateTimeVN, Vietnam zone) revealed on hover/focus. `suppressHydrationWarning` covers the
 * sub-second server↔client clock drift on the relative text — the label is inherently time-dependent,
 * not stale markup.
 */
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

/**
 * A FUTURE due moment shown as "x phút/giờ/ngày nữa" (humanizeUntil) with the exact due time
 * (formatDueExact) on hover/focus — the past-tense sibling of {@link RelativeTime}, used by the
 * resource tables' "Đến hạn" column.
 */
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
