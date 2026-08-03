'use client';

import { useOptimistic, useTransition, type MouseEvent } from 'react';
import { Star } from 'lucide-react';
import { toastResult } from '@/lib/action-toast';
import { setItemStarredAction, setSentenceStarredAction } from '@/app/actions';
import { cn } from '@/lib/utils';

/**
 * A favourite-star toggle, reused across the resources tables, the item detail page, and the history
 * cards. `kind` picks the server action (item vs sentence). Optimistic via `useOptimistic` so the fill
 * flips instantly; the server revalidates the list and the real prop settles the state. Uses the
 * `warn` (amber) token for the filled star — theme-safe, reads as gold in both light/dark. Stops click
 * propagation so tapping the star inside a clickable history card doesn't also open the card.
 */
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
