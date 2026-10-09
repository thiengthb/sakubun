import {
  CardsSkeleton,
  PageSkeleton,
  TabbedSkeleton,
  TableSkeleton,
  TabsAside,
  ToolbarSkeleton,
} from '@/components/shell/page-skeleton';

const TABLE = (
  <>
    <ToolbarSkeleton action filters={1} columnMenu />
    <TableSkeleton />
  </>
);

export default function Loading() {
  return (
    <PageSkeleton section="resources" aside={<TabsAside count={3} rail={216} select={120} />}>
      <TabbedSkeleton
        storeKey="resources.tab"
        urlKey="tab"
        initial="grammar"
        shapes={{
          grammar: TABLE,
          vocab: TABLE,
          groups: (
            <>
              <ToolbarSkeleton action filters={0} />
              <CardsSkeleton />
            </>
          ),
        }}
      />
    </PageSkeleton>
  );
}
