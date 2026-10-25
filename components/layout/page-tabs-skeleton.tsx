'use client';

import { Tabs } from '@/components/ui/tabs';
import { PageTabs } from '@/components/common/page-tabs';
import { useSessionState } from '@/components/common/use-session-state';
import { PAGE_TAB_SETS, type PageTabSetName } from '@/components/layout/page-heads';

// The page's own tabs, inert, with the one that will open underlined: a loading screen shows the
// words it already knows (docs/ui-standard.md › Đang tải).
export function PageTabsSkeleton({ set: name }: { set: PageTabSetName }) {
  const set = PAGE_TAB_SETS[name];
  const [stored] = useSessionState(set.storeKey ?? '', set.initial, set.urlKey);
  return (
    <div inert className="min-w-0">
      <Tabs value={set.storeKey ? stored : set.initial}>
        <PageTabs items={set.items} label={set.label} />
      </Tabs>
    </div>
  );
}
