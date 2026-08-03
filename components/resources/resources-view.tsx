'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/empty-state';
import { GuideLink } from '@/components/shared/guide-link';
import { ItemsTable, type ItemRow } from '@/components/resources/items-table';
import { PageShell } from '@/components/shell/page-shell';
import { ResourceAddDialog } from '@/components/resources/resource-add-dialog';
import { useSessionState } from '@/components/shared/use-session-state';
import { VocabTable, type VocabRow } from '@/components/resources/vocab-table';

/**
 * Merged "Tài nguyên" (resources) view: grammar + vocab in one page, split by tabs that sit BESIDE
 * the title (per the 2026-07-13 request). Each tab keeps its own table (sort/filter/paginate) + empty
 * state; grammar carries the import action. The two stores were separate pages (/items, /vocab) before.
 * A third "Nhóm" tab existed while the app was multi-user; it went with the community surface.
 */
export function ResourcesView({
  grammar,
  vocab,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  grammar: ItemRow[];
  vocab: VocabRow[];
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
              actionSlot={<ResourceAddDialog kind="vocab" />}
              voiceSpeaker={voiceSpeaker}
              speechRate={speechRate}
              showFurigana={showFurigana}
            />
          )}
        </TabsContent>
      </PageShell>
    </Tabs>
  );
}
