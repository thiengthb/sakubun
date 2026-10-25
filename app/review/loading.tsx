import { PageSkeleton } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// The session as it opens: the count waits on the cards, then the progress bar and a card with
// its two chips, the question and the sentence; the answer bar rests on the window bottom.
export default function Loading() {
  return (
    <PageSkeleton
      template="form"
      title="Ôn nhanh"
      meta
      pageIcons={<Skeleton className="size-9 rounded-sm md:size-7" />}
    >
      <div className="flex max-w-3xl flex-col gap-6">
        <Skeleton className="h-2 w-full rounded-full" />
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
      </div>
    </PageSkeleton>
  );
}
