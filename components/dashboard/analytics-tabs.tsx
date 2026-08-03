'use client';

import type { ReactNode } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TabSelect } from '@/components/shared/tab-select';
import { PageShell } from '@/components/shell/page-shell';
import { useSessionState } from '@/components/shared/use-session-state';

/**
 * The "Phân tích" page shell: the tab bar sits BESIDE the breadcrumb (one row, like the resources
 * view) and the active tab PERSISTS across navigation + reload (sessionStorage, mirrored to `?tab` so a
 * shared link restores it). Content is server-rendered and passed in as slots — this client wrapper only
 * owns the tab state, so the heavy dashboard/stats stay on the server.
 */
export function AnalyticsTabs({ progress, stats }: { progress: ReactNode; stats: ReactNode }) {
  const [tab, setTab] = useSessionState('analytics.tab', 'tien-do', 'tab');
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        section="dashboard"
        headerAside={
          <TabSelect
            items={[
              { value: 'tien-do', label: 'Tiến độ' },
              { value: 'thong-ke', label: 'Thống kê' },
            ]}
            value={tab}
            onValueChange={setTab}
            label="Chọn khung xem"
          />
        }
      >
        <TabsContent value="tien-do" className="space-y-6">
          {progress}
        </TabsContent>
        <TabsContent value="thong-ke">{stats}</TabsContent>
      </PageShell>
    </Tabs>
  );
}
