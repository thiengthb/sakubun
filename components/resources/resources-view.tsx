'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/empty-state';
import { GuideLink } from '@/components/shared/guide-link';
import { GroupsView } from '@/components/groups/groups-view';
import { ItemsTable, type ItemRow } from '@/components/resources/items-table';
import { PageShell } from '@/components/shell/page-shell';
import { ResourceAddDialog } from '@/components/resources/resource-add-dialog';
import { useSessionState } from '@/components/shared/use-session-state';
import { VocabTable, type VocabRow } from '@/components/resources/vocab-table';
import type { GroupSummary } from '@/lib/groups';

/**
 * Merged "Tài nguyên" (resources) view: grammar + vocab in one page, split by tabs that sit BESIDE
 * the title (per the 2026-07-13 request). Each tab keeps its own table (sort/filter/paginate) + empty
 * state; grammar carries the import action. The two stores were separate pages (/items, /vocab) before.
 */
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
          <TabsList>
            <TabsTrigger value="grammar">Ngữ pháp</TabsTrigger>
            <TabsTrigger value="vocab">Từ vựng</TabsTrigger>
            <TabsTrigger value="groups">Nhóm</TabsTrigger>
          </TabsList>
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
                  <ResourceAddDialog kind="grammar" />
                  <GuideLink topic="library" label="Ba cách nhập kho" />
                </div>
              }
            />
          ) : (
            <ItemsTable
              items={grammar}
              groups={groups}
              importSlot={<ResourceAddDialog kind="grammar" />}
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
                  <ResourceAddDialog kind="vocab" />
                  <GuideLink topic="vocab" label="Cách học từ vựng trong ngữ cảnh" />
                </div>
              }
            />
          ) : (
            <VocabTable
              items={vocab}
              groups={groups}
              actionSlot={<ResourceAddDialog kind="vocab" />}
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
