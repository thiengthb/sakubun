import { cn } from '@/lib/core/utils';

// How much of a shared group the learner has (7.4h): a thin bar, green once they have it all.
export function HaveBar({
  have,
  size,
  label,
  className,
}: {
  have: number;
  size: number;
  /** What the bar measures, read by a screen reader ("N5 · Ngữ pháp"). */
  label: string;
  className?: string;
}) {
  const ratio = size > 0 ? Math.min(have / size, 1) : 0;
  return (
    <span
      role="progressbar"
      aria-label={`Đã có trong kho: ${label}`}
      aria-valuemin={0}
      aria-valuemax={size}
      aria-valuenow={have}
      className={cn('block h-1.5 overflow-hidden rounded-full bg-muted', className)}
    >
      <span
        className={cn('block h-full rounded-full', ratio === 1 ? 'bg-ok' : 'bg-accent-brand')}
        style={{ width: `${ratio * 100}%` }}
      />
    </span>
  );
}

/** "Đã có 12/81", "Chưa có", or "Đã có đủ". */
export function haveText(have: number, size: number) {
  if (have === 0) return 'Chưa có';
  if (have >= size) return 'Đã có đủ';
  return `Đã có ${have}/${size}`;
}
