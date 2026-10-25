import { PageSkeleton, PageTabsSkeleton, TabbedSkeleton } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/core/utils';

const BUTTON = 'h-9 rounded-sm md:h-7';

function SectionSkeleton({ heading, children }: { heading: number; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex h-5 items-center">
        <Skeleton className="h-3.5" style={{ width: heading }} />
      </div>
      {children}
    </section>
  );
}

export default function Loading() {
  return (
    <PageSkeleton
      template="detail"
      trail
      meta={
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <div className="flex h-5 items-center max-md:basis-full">
            <Skeleton className="h-3.5 w-36" />
          </div>
          <Skeleton className="h-5 w-9 rounded-sm" />
          <Skeleton className="h-5 w-16 rounded-sm" />
        </div>
      }
      actions={
        <>
          <Skeleton className={cn(BUTTON, 'md:w-28')} />
          <Skeleton className={cn(BUTTON, 'md:w-32')} />
        </>
      }
      actionsOnPhone="split"
      pageIcons={<Skeleton className="size-7 rounded-md" />}
      tabs={<PageTabsSkeleton count={2} widths={[104, 96]} />}
    >
      <div className="@container grid gap-6 md:gap-8">
        <div className="space-y-6 md:space-y-8">
          <SectionSkeleton heading={64}>
            <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4 @2xl:gap-3">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-20 rounded-sm" />
              ))}
            </div>
          </SectionSkeleton>
          <SectionSkeleton heading={40}>
            <Skeleton className={cn(BUTTON, 'w-20')} />
          </SectionSkeleton>
        </div>
        <TabbedSkeleton
          storeKey="item.tab"
          initial="stats"
          shapes={{
            stats: (
              <div className="space-y-6 md:space-y-8">
                <SectionSkeleton heading={112}>
                  <Skeleton className="h-64 rounded-xl" />
                </SectionSkeleton>
                <SectionSkeleton heading={96}>
                  <Skeleton className="h-48 rounded-xl" />
                </SectionSkeleton>
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
