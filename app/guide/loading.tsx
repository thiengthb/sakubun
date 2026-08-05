import { PageSkeleton, TabsAside } from '@/components/shell/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// /guide — 4 tabs (Bắt đầu / Tính năng / Theo việc / Tra cứu) plus the intro lightbulb pinned right.
// Rail 307px at 1440, select 103px at 390 (measured).
//
// NEW 2026-08-05: this route had no loading.tsx, so it fell back to the ROOT one — meaning every visit to
// the guide flashed a dashboard (four stat cards and three charts) before showing prose. Every tab here
// is a stack of long content cards, so one shape covers all four.
export default function Loading() {
  return (
    <PageSkeleton
      section="guide"
      aside={
        <>
          <TabsAside count={4} rail={307} select={103} />
          <Skeleton className="ml-auto size-8 shrink-0 rounded-md" />
        </>
      }
    >
      <div className="space-y-6">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </PageSkeleton>
  );
}
