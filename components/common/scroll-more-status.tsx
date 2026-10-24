import type { Ref } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/core/utils';

/** The end of a card list that loads more as it scrolls: a spinner while more is coming, then the count. */
export function ScrollMoreStatus({
  ref,
  hasMore,
  total,
  className,
}: {
  /** useScrollMore's sentinel. */
  ref: Ref<HTMLDivElement>;
  hasMore: boolean;
  total: string;
  className?: string;
}) {
  return (
    <div
      ref={ref}
      role="status"
      className={cn(
        'flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground',
        className,
      )}
    >
      {hasMore ? (
        <>
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          Đang tải thêm…
        </>
      ) : (
        total
      )}
    </div>
  );
}
