'use client';

import { Globe } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/empty-state';
import { GuideLink } from '@/components/shared/guide-link';
import { LibraryTable } from '@/components/library/library-table';
import { PageShell } from '@/components/shell/page-shell';
import { useSessionState } from '@/components/shared/use-session-state';
import type { LibraryEntry } from '@/lib/library';

interface AudioProps {
  voiceSpeaker: number;
  speechRate: number;
  showFurigana: boolean;
}

/**
 * The /library page body: browse OTHERS' shared items (content only — never their schedule/history)
 * and "lấy về kho của tôi" (fork). Two tabs (Ngữ pháp | Từ vựng), each a <DataTable> (see LibraryTable)
 * with per-row detail (enrich) + take-into-kho actions; an already-owned item shows a disabled check.
 */
export function LibraryView({
  grammar,
  vocab,
  voiceSpeaker,
  speechRate,
  showFurigana,
}: {
  grammar: LibraryEntry[];
  vocab: LibraryEntry[];
} & AudioProps) {
  const audio = { voiceSpeaker, speechRate, showFurigana };
  // Remember the active tab across navigation + reload (same session).
  const [tab, setTab] = useSessionState('library.tab', 'grammar', 'tab');

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        section="library"
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
              icon={Globe}
              title="Thư viện chung chưa có mẫu nào"
              description="Khi có người chia sẻ mẫu ngữ pháp, chúng sẽ hiện ở đây để bạn lấy về kho."
              action={<GuideLink topic="sharing" label="Cách chia sẻ & lấy về" />}
            />
          ) : (
            <LibraryTable kind="grammar" entries={grammar} {...audio} />
          )}
        </TabsContent>
        <TabsContent value="vocab">
          {vocab.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="Thư viện chung chưa có từ nào"
              description="Khi có người chia sẻ từ vựng, chúng sẽ hiện ở đây để bạn lấy về kho."
              action={<GuideLink topic="sharing" label="Cách chia sẻ & lấy về" />}
            />
          ) : (
            <LibraryTable kind="vocab" entries={vocab} {...audio} />
          )}
        </TabsContent>
      </PageShell>
    </Tabs>
  );
}
