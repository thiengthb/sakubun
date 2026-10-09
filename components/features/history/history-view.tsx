import { EmptyState } from '@/components/common/empty-state';
import { HistoryList } from '@/components/features/history/history-list';
import { PageShell } from '@/components/layout/page-shell';
import type { FuriganaMode } from '@/lib/settings/schema';
import type { SentenceHistoryRow } from '@/lib/library/practice';

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
              Mở Claude Desktop hoặc ChatGPT và chạy prompt <code>practice</code> để bắt đầu.
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
