'use client';

import { useOptimistic, useTransition, type MouseEvent } from 'react';
import { Star } from 'lucide-react';
import { toastResult } from '@/lib/core/action-toast';
import { setItemStarredAction, setSentenceStarredAction } from '@/app/actions';
import { cn } from '@/lib/core/utils';

export function StarButton({
  id,
  starred,
  kind,
  className,
}: {
  id: string;
  starred: boolean;
  kind: 'item' | 'sentence';
  className?: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(starred);
  const [, startTransition] = useTransition();

  const toggle = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      const action = kind === 'item' ? setItemStarredAction : setSentenceStarredAction;
      const r = await action(id, next);
      toastResult(r, next ? 'Đã đánh dấu sao' : 'Đã bỏ sao');
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={optimistic}
      aria-label={optimistic ? 'Bỏ đánh dấu sao' : 'Đánh dấu sao'}
      title={optimistic ? 'Bỏ đánh dấu sao' : 'Đánh dấu sao'}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
        optimistic
          ? 'text-warn hover:bg-warn/10'
          : 'text-muted-foreground/50 hover:bg-muted hover:text-warn',
        className,
      )}
    >
      <Star className={cn('size-4', optimistic && 'fill-current')} aria-hidden />
    </button>
  );
}
