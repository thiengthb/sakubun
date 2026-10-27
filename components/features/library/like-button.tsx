'use client';

import { useOptimistic, useTransition } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setLikeAction } from '@/app/library/actions';
import { toast } from 'sonner';
import { cn } from '@/lib/core/utils';

// "Thích" on a shared entry or group (phase 8, L3): the count beside the heart, one per learner.
export function LikeButton({
  entryId,
  liked,
  likes,
  name,
}: {
  entryId: string;
  liked: boolean;
  likes: number;
  name: string;
}) {
  const [state, setState] = useOptimistic({ liked, likes });
  const [, startTransition] = useTransition();
  const toggle = () =>
    startTransition(async () => {
      const next = !state.liked;
      setState({ liked: next, likes: state.likes + (next ? 1 : -1) });
      const res = await setLikeAction(entryId, next);
      if (!res.ok) toast.error(res.error);
    });
  return (
    <Button
      variant="ghost"
      onClick={toggle}
      aria-pressed={state.liked}
      aria-label={`${state.liked ? 'Bỏ thích' : 'Thích'} ${name}`}
      className={cn('relative z-10', state.liked ? 'text-destructive' : 'text-muted-foreground')}
    >
      <Heart aria-hidden className={cn(state.liked && 'fill-current')} />
      {state.likes}
    </Button>
  );
}
