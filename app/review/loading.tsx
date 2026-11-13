import { Skeleton } from '@/components/ui/skeleton';
import { SessionFrame } from '@/components/features/review/session-frame';

// The session as it opens, in the session's frame: the count waiting on the cards, the X, the
// progress bar, then a card with its two chips, the question and the sentence.
export default function Loading() {
  return (
    <SessionFrame
      actions={<Skeleton className="size-9 rounded-sm md:size-7" />}
      meta={
        <div className="flex h-4 items-center">
          <Skeleton className="h-3 w-20" />
        </div>
      }
      progress={<Skeleton className="h-2 w-full rounded-full" />}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-72 max-w-full" />
      </div>
    </SessionFrame>
  );
}
