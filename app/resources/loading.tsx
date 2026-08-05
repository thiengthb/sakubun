import {
  CardsSkeleton,
  PageSkeleton,
  TabbedSkeleton,
  TableSkeleton,
  TabsAside,
  ToolbarSkeleton,
} from '@/components/shell/page-skeleton';

// Resources — 3 tabs (Ngữ pháp / Từ vựng / Nhóm). Rail 216px at 1440, select 120px at 390 (measured).
//
// The BODY DEPENDS ON THE TAB, and the tab is restored from sessionStorage, so a fixed shape is wrong
// for anyone whose last tab was "Nhóm": the two item tabs are a data table (cards below md), the groups
// tab is a card grid. `TabbedSkeleton` reads the same `resources.tab` key through the same hook the page
// uses, so the skeleton and the page cannot disagree about what comes next.
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
