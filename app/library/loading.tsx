import {
  CardsSkeleton,
  PageSkeleton,
  PageTabsSkeleton,
  TabbedSkeleton,
  ToolbarSkeleton,
} from '@/components/layout/page-skeleton';

// LibraryView's shape: groups as cards, or the search row over entry cards.
export default function Loading() {
  return (
    <PageSkeleton template="list" title="Kho chung" meta tabs={<PageTabsSkeleton set="library" />}>
      <TabbedSkeleton
        storeKey="library.tab"
        urlKey="tab"
        initial="groups"
        shapes={{
          groups: <CardsSkeleton rowHeight={84} footer={false} />,
          items: (
            <>
              <ToolbarSkeleton filters={2} />
              <CardsSkeleton rowHeight={96} footer={false} />
            </>
          ),
        }}
      />
    </PageSkeleton>
  );
}
