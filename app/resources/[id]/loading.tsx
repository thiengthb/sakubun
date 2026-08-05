import { PageSkeleton, TabbedSkeleton } from '@/components/shell/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// Item detail — NOTHING in the header aside (the level/state tags and the star moved down into the item
// header on 2026-08-05), then, measured at both widths:
//   header block 62px  — the term + meaning row with the star pinned right, then the tags/meta row
//   groups row  30px   — the "which groups is this in" chips
//   tab row     32px   — TWO REAL tabs (not the select): a 198px pair at 1440, full-width below md
//                        (`max-md:w-full`), with the two copy-command buttons md-and-up only
//   then the 8-card metric grid (2 cols on a phone, 4 from sm) and the forgetting-curve card.
export default function Loading() {
  return (
    <PageSkeleton>
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="size-7 shrink-0 rounded-md" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-10 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
      </header>

      {/* Study-group chips. */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-6 w-24 rounded-md" />
        <Skeleton className="h-6 w-8 rounded-md" />
      </div>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {/* The real pair splits the phone's row evenly and is 198px wide from md up. */}
          <div className="flex h-8 items-center gap-1 rounded-lg bg-muted p-[3px] max-md:w-full md:w-[198px]">
            <Skeleton className="h-full flex-1 rounded-md" />
            <Skeleton className="h-full flex-1 rounded-md" />
          </div>
          <div className="hidden gap-2 md:ml-auto md:flex">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>

        {/* The two sub-tabs are session state (`item.tab`) like every other tab in the app, and their
            bodies have nothing in common: a metric grid + charts, versus one long detail card. */}
        <TabbedSkeleton
          storeKey="item.tab"
          initial="stats"
          shapes={{
            stats: (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} className="h-[74px] rounded-xl sm:h-[86px]" />
                  ))}
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-6 w-44" />
                  <Skeleton className="h-64 rounded-xl" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-48 rounded-xl" />
                </div>
              </div>
            ),
            detail: (
              <div className="space-y-4">
                <Skeleton className="h-72 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
              </div>
            ),
          }}
        />
      </div>
    </PageSkeleton>
  );
}
