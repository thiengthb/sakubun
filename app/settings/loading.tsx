import { PageSkeleton, TabsAside } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// One band: the SectionHeading (icon tile + title + hint) over its group cards.
function BandSkeleton({ groups }: { groups: number[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3 pt-2">
        <Skeleton className="size-8 shrink-0 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
      </div>
      <div className="space-y-6">
        {groups.map((height, i) => (
          <div key={i} className="space-y-3">
            <div className="space-y-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <Skeleton className="rounded-xl" style={{ height }} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Loading() {
  return (
    <PageSkeleton
      section="settings"
      aside={
        <>
          <TabsAside count={3} rail={233} select={119} />
          <Skeleton className="ml-auto size-8 shrink-0 rounded-md" />
        </>
      }
    >
      {/* Three bands, matching the Luyện tập tab: Nội dung học · Nhịp học · Trình bày & tự động. */}
      <div className="space-y-8">
        <BandSkeleton groups={[300, 420]} />
        <BandSkeleton groups={[200, 120]} />
        <BandSkeleton groups={[200, 140]} />
      </div>
    </PageSkeleton>
  );
}
