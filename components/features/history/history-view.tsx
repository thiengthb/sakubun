'use client';

import { History } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { PageTabs } from '@/components/common/page-tabs';
import { useSessionState } from '@/components/common/use-session-state';
import { HistoryList } from '@/components/features/history/history-list';
import { RoleplayList } from '@/components/features/history/roleplay-list';
import { PageShell } from '@/components/layout/page-shell';
import { HISTORY_TABS } from '@/components/layout/page-heads';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { furiganaInApp, type FuriganaMode } from '@/lib/settings/schema';
import type { HistoryRow } from '@/lib/app/history';
import type { RoleplayRow } from '@/lib/kaiwa/roleplays';

// List template: every translation turn, newest first, and under Nhập vai the role-plays saved
// from Kaiwa (d2). Nothing is created here (the MCP tutor stages and grades turns, Claude saves a
// role-play), so the header has no action.
export function HistoryView({
  sentences,
  roleplays = [],
  voiceSpeaker,
  speechRate,
  furiganaMode = 'app',
}: {
  sentences: HistoryRow[];
  roleplays?: RoleplayRow[];
  voiceSpeaker?: number;
  speechRate?: number;
  furiganaMode?: FuriganaMode;
}) {
  const [tab, setTab] = useSessionState(
    HISTORY_TABS.storeKey,
    HISTORY_TABS.initial,
    HISTORY_TABS.urlKey,
  );
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        template="list"
        title="Tiến độ"
        meta={
          tab === 'nhap-vai' ? `${roleplays.length} buổi nhập vai` : `${sentences.length} lượt dịch`
        }
        tabs={<PageTabs items={HISTORY_TABS.items} label={HISTORY_TABS.label} />}
      >
        <TabsContent value="dich">
          {sentences.length === 0 ? (
            <EmptyState
              icon={History}
              title="Chưa có lượt dịch nào"
              description={
                <>
                  Mở Claude Desktop hoặc ChatGPT và chạy prompt <code>practice</code> để bắt đầu.
                </>
              }
            />
          ) : (
            <HistoryList
              sentences={sentences}
              voiceSpeaker={voiceSpeaker}
              speechRate={speechRate}
              showFurigana={furiganaInApp(furiganaMode)}
            />
          )}
        </TabsContent>
        <TabsContent value="nhap-vai">
          <RoleplayList roleplays={roleplays} />
        </TabsContent>
      </PageShell>
    </Tabs>
  );
}
