'use client';

import { BookText, FolderOpen, Languages } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PageTabs } from '@/components/common/page-tabs';
import { EmptyState } from '@/components/common/empty-state';
import { ResourceTable, type ResourceRow } from '@/components/features/resources/resource-table';
import { PageShell } from '@/components/layout/page-shell';
import { AddButton, ResourceAddButton } from '@/components/features/resources/resource-add-button';
import { useSessionState } from '@/components/common/use-session-state';
import { GroupsView } from '@/components/features/groups/groups-view';
import type { GroupSummary } from '@/lib/library/groups';

const RESOURCE_TABS = [
  { value: 'grammar', label: 'Ngữ pháp', icon: BookText },
  { value: 'vocab', label: 'Từ vựng', icon: Languages },
  { value: 'groups', label: 'Nhóm', icon: FolderOpen },
] as const;

export function ResourcesView({
  grammar,
  vocab,
  groups,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  grammar: ResourceRow[];
  vocab: ResourceRow[];
  groups: GroupSummary[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  const [tab, setTab] = useSessionState('resources.tab', 'grammar', 'tab');
  // List template: the page's one create action sits in the header and follows the open tab, so
  // neither the toolbar nor an empty state repeats it.
  const meta =
    tab === 'groups'
      ? `${groups.length} nhóm`
      : tab === 'vocab'
        ? `${vocab.length} từ vựng`
        : `${grammar.length} mẫu ngữ pháp`;
  const action =
    tab === 'groups' ? (
      <AddButton href="/groups/new" />
    ) : (
      <ResourceAddButton kind={tab === 'vocab' ? 'vocab' : 'grammar'} />
    );

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        template="list"
        title="Tài nguyên"
        meta={meta}
        actions={action}
        tabs={<PageTabs items={RESOURCE_TABS} label="Chọn kho" />}
      >
        <TabsContent value="grammar">
          {grammar.length === 0 ? (
            <EmptyState
              icon={BookText}
              title="Chưa có mẫu ngữ pháp"
              description={
                <>
                  Bấm Thêm, hoặc nhờ trợ lý MCP với prompt <code>import_grammar</code>.
                </>
              }
            />
          ) : (
            <ResourceTable
              kind="grammar"
              items={grammar}
              groups={groups}
              voiceSpeaker={voiceSpeaker}
              speechRate={speechRate}
              showFurigana={showFurigana}
            />
          )}
        </TabsContent>

        <TabsContent value="vocab">
          {vocab.length === 0 ? (
            <EmptyState
              icon={Languages}
              title="Chưa có từ vựng"
              description={
                <>
                  Bấm Thêm, hoặc khi luyện nói <em>“thêm từ này”</em> để trợ lý MCP thêm.
                </>
              }
            />
          ) : (
            <ResourceTable
              kind="vocab"
              items={vocab}
              groups={groups}
              voiceSpeaker={voiceSpeaker}
              speechRate={speechRate}
              showFurigana={showFurigana}
            />
          )}
        </TabsContent>
        <TabsContent value="groups">
          <GroupsView groups={groups} />
        </TabsContent>
      </PageShell>
    </Tabs>
  );
}
