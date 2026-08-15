'use client';

import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TabSelect } from '@/components/shared/tab-select';
import { EmptyState } from '@/components/shared/empty-state';
import { ResourceTable, type ResourceRow } from '@/components/resources/resource-table';
import { PageShell } from '@/components/shell/page-shell';
import { ResourceAddButton } from '@/components/resources/resource-add-button';
import { useSessionState } from '@/components/shared/use-session-state';
import { GroupsView } from '@/components/groups/groups-view';
import type { GroupSummary } from '@/lib/groups';

const RESOURCE_TABS = [
  { value: 'grammar', label: 'Ngữ pháp' },
  { value: 'vocab', label: 'Từ vựng' },
  { value: 'groups', label: 'Nhóm' },
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
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        section="resources"
        headerAside={
          <TabSelect
            items={RESOURCE_TABS}
            value={tab}
            onValueChange={setTab}
            label="Chọn kho"
          />
        }
      >
        <TabsContent value="grammar">
          {grammar.length === 0 ? (
            <EmptyState
              title="Kho ngữ pháp đang trống"
              description={
                <>
                  Nhập bên dưới, hoặc mở Claude Desktop và dùng prompt <code>import_grammar</code>.
                </>
              }
              action={
                <ResourceAddButton kind="grammar" />
              }
            />
          ) : (
            <ResourceTable
              kind="grammar"
              items={grammar}
              groups={groups}
              actionSlot={<ResourceAddButton kind="grammar" />}
              voiceSpeaker={voiceSpeaker}
              speechRate={speechRate}
              showFurigana={showFurigana}
            />
          )}
        </TabsContent>

        <TabsContent value="vocab">
          {vocab.length === 0 ? (
            <EmptyState
              title="Chưa có từ vựng nào"
              description={
                <>
                  Thêm thủ công bên dưới, hoặc khi luyện hãy hỏi Claude nghĩa một từ (nói{' '}
                  <em>“thêm từ này”</em>) để Claude thêm qua <code>add_vocab</code>.
                </>
              }
              action={
                <ResourceAddButton kind="vocab" />
              }
            />
          ) : (
            <ResourceTable
              kind="vocab"
              items={vocab}
              groups={groups}
              actionSlot={<ResourceAddButton kind="vocab" />}
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
