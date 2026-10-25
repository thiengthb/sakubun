'use client';

import type { ReactNode } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabs } from '@/components/common/page-tabs';
import { PageShell } from '@/components/layout/page-shell';
import { ANALYTICS_TABS } from '@/components/layout/page-heads';
import { useSessionState } from '@/components/common/use-session-state';

export function AnalyticsTabs({
  progress,
  stats,
  aside,
}: {
  progress: ReactNode;
  stats: ReactNode;
  aside?: ReactNode;
}) {
  const [tab, setTab] = useSessionState(
    ANALYTICS_TABS.storeKey,
    ANALYTICS_TABS.initial,
    ANALYTICS_TABS.urlKey,
  );
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        template="dashboard"
        title="Phân tích"
        actions={tab === 'tien-do' ? aside : undefined}
        tabs={<PageTabs items={ANALYTICS_TABS.items} label={ANALYTICS_TABS.label} />}
      >
        <TabsContent value="tien-do" className="space-y-3">
          {progress}
        </TabsContent>
        <TabsContent value="thong-ke">{stats}</TabsContent>
      </PageShell>
    </Tabs>
  );
}
