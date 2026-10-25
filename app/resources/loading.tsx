import {
  CardsSkeleton,
  PageSkeleton,
  PageTabsSkeleton,
  TabbedSkeleton,
  TableSkeleton,
  ToolbarSkeleton,
} from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

const TABLE = (
  <>
    <ToolbarSkeleton filters={1} columnMenu />
    <TableSkeleton />
  </>
);

export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      title="Tài nguyên"
      meta
      actions={<Skeleton className="h-9 w-20 rounded-sm md:h-7" />}
      tabs={<PageTabsSkeleton set="resources" />}
    >
      <TabbedSkeleton
        storeKey="resources.tab"
        urlKey="tab"
        initial="grammar"
        shapes={{
          grammar: TABLE,
          vocab: TABLE,
          groups: (
            <>
              <ToolbarSkeleton filters={1} />
              <CardsSkeleton rowHeight={108} footer={false} />
            </>
          ),
        }}
      />
    </PageSkeleton>
  );
}
