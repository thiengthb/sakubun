import { EmptyState } from '@/components/shared/empty-state';
import { HistoryList } from '@/components/history/history-list';
import { PageShell } from '@/components/shell/page-shell';
import type { FuriganaMode } from '@/lib/settings-schema';
import type { SentenceHistoryRow } from '@/lib/practice';

export function HistoryView({
  sentences,
  voiceSpeaker,
  speechRate,
  furiganaMode = 'app',
}: {
  sentences: SentenceHistoryRow[];
  voiceSpeaker?: number;
  speechRate?: number;
  furiganaMode?: FuriganaMode;
}) {
  return (
    <PageShell section="history">
      {sentences.length === 0 ? (
        <EmptyState
          title="Chưa có lượt dịch nào"
          description={
            <>
              Mở Claude Desktop và chạy prompt <code>practice</code> để bắt đầu.
            </>
          }
        />
      ) : (
        <HistoryList
          sentences={sentences}
          voiceSpeaker={voiceSpeaker}
          speechRate={speechRate}
          furiganaMode={furiganaMode}
        />
      )}
    </PageShell>
  );
}
