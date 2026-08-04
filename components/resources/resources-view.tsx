'use client';

import { Tabs, TabsContent } from '@/components/ui/tabs';
import { TabSelect } from '@/components/shared/tab-select';
import { EmptyState } from '@/components/shared/empty-state';
import { GuideLink } from '@/components/shared/guide-link';
import { ItemsTable, type ItemRow } from '@/components/resources/items-table';
import { PageShell } from '@/components/shell/page-shell';
import { ResourceAddButton } from '@/components/resources/resource-add-button';
import { useSessionState } from '@/components/shared/use-session-state';
import { VocabTable, type VocabRow } from '@/components/resources/vocab-table';
import { GroupsView } from '@/components/groups/groups-view';
import type { GroupSummary } from '@/lib/groups';

/**
 * Merged "Tài nguyên" (resources) view: grammar + vocab in one page, split by tabs that sit BESIDE
 * the title (per the 2026-07-13 request). Each tab keeps its own table (sort/filter/paginate) + empty
 * state; grammar carries the import action. The two stores were separate pages (/items, /vocab) before.
 * The third "Nhóm" tab (study groups) went out with the multi-user/community surface on 2026-08-03 and
 * came BACK single-user on 2026-08-05 — see lib/groups.ts.
 */
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
  grammar: ItemRow[];
  vocab: VocabRow[];
  groups: GroupSummary[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  // Remember the active tab across navigation + reload (same session).
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
                <div className="flex flex-col items-center gap-2">
                  <ResourceAddButton kind="grammar" />
                  <GuideLink topic="library" label="Ba cách nhập kho" />
                </div>
              }
            />
          ) : (
            <ItemsTable
              items={grammar}
              importSlot={<ResourceAddButton kind="grammar" />}
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
                <div className="flex flex-col items-center gap-2">
                  <ResourceAddButton kind="vocab" />
                  <GuideLink topic="vocab" label="Cách học từ vựng trong ngữ cảnh" />
                </div>
              }
            />
          ) : (
            <VocabTable
              items={vocab}
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
