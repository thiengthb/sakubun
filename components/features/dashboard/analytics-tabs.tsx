'use client';

import type { ReactNode } from 'react';
import { ChartColumn, TrendingUp } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabs } from '@/components/common/page-tabs';
import { PageShell } from '@/components/layout/page-shell';
import { useSessionState } from '@/components/common/use-session-state';

const ANALYTICS_TABS = [
  { value: 'tien-do', label: 'Tiến độ', icon: TrendingUp },
  { value: 'thong-ke', label: 'Thống kê', icon: ChartColumn },
] as const;

export function AnalyticsTabs({
  progress,
  stats,
  aside,
}: {
  progress: ReactNode;
  stats: ReactNode;
  aside?: ReactNode;
}) {
  const [tab, setTab] = useSessionState('analytics.tab', 'tien-do', 'tab');
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        template="dashboard"
        title="Phân tích"
        actions={tab === 'tien-do' ? aside : undefined}
        tabs={<PageTabs items={ANALYTICS_TABS} label="Chọn khung xem" />}
      >
        <TabsContent value="tien-do" className="space-y-3">
          {progress}
        </TabsContent>
        <TabsContent value="thong-ke">{stats}</TabsContent>
      </PageShell>
    </Tabs>
  );
}
