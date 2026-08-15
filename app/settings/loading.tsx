import { PageSkeleton, TabsAside } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <PageSkeleton
      section="settings"
      aside={
        <>
          <TabsAside count={5} rail={396} select={114} />
          <Skeleton className="ml-auto size-8 shrink-0 rounded-md" />
        </>
      }
    >
      <div className="space-y-6">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </PageSkeleton>
  );
}
