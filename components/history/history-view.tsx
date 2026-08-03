import { EmptyState } from '@/components/shared/empty-state';
import { HistoryList } from '@/components/history/history-list';
import { PageShell } from '@/components/shell/page-shell';
import type { FuriganaMode } from '@/lib/settings-schema';
import type { SentenceHistoryRow } from '@/lib/practice';

/**
 * /history — your own translation attempts. Was a two-tab shell ("Của tôi" / "Cộng đồng"); the
 * community feed is gone with the rest of the multi-user surface, so a single tab would be chrome
 * around nothing. Server component now: nothing here needs client state.
 */
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
