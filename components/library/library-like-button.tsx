'use client';

import { useOptimistic, useTransition } from 'react';
import { Heart } from 'lucide-react';
import { toastResult } from '@/lib/action-toast';
import { toggleItemLikeAction } from '@/app/actions';
import { cn } from '@/lib/utils';

/**
 * Public like/upvote on a PUBLIC library item (Phase 5 — the /library heart). Heart fills (brand color)
 * when the viewer has liked; the count sits beside it. Optimistic via `useOptimistic`, re-syncing from
 * props after `/library` revalidates.
 *
 * NOTE (code-reuse): this is the SECOND like button (the first is the sentence heart in `community-feed`).
 * Duplicated on purpose per the rule-of-three (extract only at the 3rd) — logged in
 * `nuc-platform/08-SHARED-ASSETS.md` so a third occurrence triggers a shared `<LikeButton>`.
 */
export function LibraryLikeButton({
  itemId,
  count,
  likedByMe,
}: {
  itemId: string;
  count: number;
  likedByMe: boolean;
}) {
  const [opt, setOpt] = useOptimistic({ liked: likedByMe, count });
  const [, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      setOpt({ liked: !opt.liked, count: opt.count + (opt.liked ? -1 : 1) });
      const r = await toggleItemLikeAction(itemId);
      if (!r.ok) toastResult(r, '');
    });

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={opt.liked}
      aria-label={opt.liked ? 'Bỏ thích' : 'Thích'}
      title={opt.liked ? 'Bỏ thích' : 'Thích'}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        opt.liked ? 'text-accent-brand' : 'text-muted-foreground hover:text-accent-brand',
      )}
    >
      <Heart className={cn('size-3.5', opt.liked && 'fill-current')} aria-hidden />
      {opt.count > 0 && <span className="tabular-nums">{opt.count}</span>}
    </button>
  );
}
