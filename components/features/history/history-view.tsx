import { History } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { HistoryTable } from '@/components/features/history/history-table';
import { PageShell } from '@/components/layout/page-shell';
import { furiganaInApp, type FuriganaMode } from '@/lib/settings/schema';
import type { HistoryRow } from '@/lib/app/history';

// List template: every translation turn, newest first. Nothing is created here (the MCP tutor
// stages and grades turns), so the header has no action.
export function HistoryView({
  sentences,
  voiceSpeaker,
  speechRate,
  furiganaMode = 'app',
}: {
  sentences: HistoryRow[];
  voiceSpeaker?: number;
  speechRate?: number;
  furiganaMode?: FuriganaMode;
}) {
  return (
    <PageShell template="list" title="Lịch sử" meta={`${sentences.length} lượt dịch`}>
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
        <HistoryTable
          sentences={sentences}
          voiceSpeaker={voiceSpeaker}
          speechRate={speechRate}
          showFurigana={furiganaInApp(furiganaMode)}
        />
      )}
    </PageShell>
  );
}
