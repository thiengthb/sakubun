'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Clock, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Truncate } from '@/components/ui/truncate';
import { DataTable } from '@/components/common/data-table';
import { Explain } from '@/components/common/explain';
import { RelativeTime } from '@/components/common/relative-time';
import { SpokenLine } from '@/components/common/spoken-line';
import { StarButton } from '@/components/common/star-button';
import { useSessionState } from '@/components/common/use-session-state';
import {
  HistoryCard,
  HistoryDetail,
  dirLabel,
  durationSecOf,
  exerciseTypeLabel,
  resultLabel,
} from '@/components/features/history/history-cards';
import {
  DEFAULT_FILTERS,
  HistoryFilterPopover,
  historyChips,
  matchesFilters,
  type Filters,
} from '@/components/features/history/history-filters';
import { humanizeDuration } from '@/lib/core/format';
import { PAGE_SIZE_OPTIONS } from '@/lib/core/pagination';
import { cn } from '@/lib/core/utils';
import type { HistoryRow } from '@/lib/app/history';

interface Prefs {
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}

// Sorts a 1-4 grade and a 0-100 score on one scale; waiting and skipped turns sort last.
function resultRank(s: HistoryRow): number {
  if (s.status !== 'GRADED') return -1;
  if (s.rating !== null) return s.rating * 25;
  return s.score ?? -1;
}

function ResultCell({ row }: { row: HistoryRow }) {
  if (row.status === 'PENDING') {
    return (
      <Explain text="Trả lời qua Claude Desktop hoặc ChatGPT để được chấm. Muốn bỏ qua thì bảo trợ lý MCP «bỏ qua câu này».">
        <span className="inline-flex items-center gap-1 font-medium text-warn">
          <Clock className="size-4" aria-hidden />
          Đang chờ
        </span>
      </Explain>
    );
  }
  const label = resultLabel(row);
  return label ? (
    <span className={cn('font-medium', label.className)}>{label.text}</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

function columns(prefs: Prefs, open: (id: string) => void): ColumnDef<HistoryRow>[] {
  return [
    {
      id: 'source',
      accessorKey: 'sourceText',
      header: 'Đề',
      size: 280,
      minSize: 160,
      enableHiding: false,
      enableSorting: false,
      meta: { label: 'Đề' },
      cell: ({ row }) => {
        const s = row.original;
        return s.direction === 'JA_VI' ? (
          <SpokenLine
            text={s.sourceText}
            ruby={s.sourceRuby}
            showFurigana={prefs.showFurigana}
            speaker={prefs.voiceSpeaker}
            rate={prefs.speechRate}
            label="Nghe đề"
            truncate
          />
        ) : (
          <Truncate>{s.sourceText}</Truncate>
        );
      },
    },
    {
      id: 'answer',
      // The search reads the reference answer too, which the cell leaves to the detail.
      accessorFn: (s) => `${s.userAnswer} ${s.suggested ?? ''}`,
      header: 'Bạn dịch',
      size: 200,
      minSize: 120,
      enableSorting: false,
      meta: { label: 'Bạn dịch', cellClassName: 'text-muted-foreground' },
      cell: ({ row }) =>
        row.original.userAnswer ? <Truncate>{row.original.userAnswer}</Truncate> : '—',
    },
    {
      id: 'result',
      accessorFn: resultRank,
      header: 'Kết quả',
      size: 104,
      minSize: 90,
      enableGlobalFilter: false,
      meta: { label: 'Kết quả', cellClassName: 'whitespace-nowrap' },
      cell: ({ row }) => <ResultCell row={row.original} />,
    },
    {
      id: 'direction',
      accessorFn: (s) => dirLabel(s.direction),
      header: 'Chiều',
      size: 90,
      minSize: 84,
      enableGlobalFilter: false,
      meta: { label: 'Chiều dịch', cellClassName: 'whitespace-nowrap text-muted-foreground' },
    },
    {
      id: 'type',
      accessorFn: (s) => exerciseTypeLabel(s.exerciseType) ?? '—',
      header: 'Dạng',
      size: 110,
      minSize: 90,
      enableGlobalFilter: false,
      meta: { label: 'Dạng bài', cellClassName: 'whitespace-nowrap text-muted-foreground' },
    },
    {
      id: 'level',
      accessorFn: (s) => s.level ?? '',
      header: 'Cấp',
      size: 80,
      minSize: 72,
      enableGlobalFilter: false,
      meta: { label: 'Độ khó (JLPT)' },
      cell: ({ row }) => row.original.level ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: 'duration',
      accessorFn: (s) => durationSecOf(s) ?? Infinity,
      header: 'Thời gian',
      size: 104,
      minSize: 84,
      enableGlobalFilter: false,
      meta: {
        label: 'Thời gian làm',
        defaultHidden: true,
        cellClassName: 'whitespace-nowrap text-muted-foreground tabular-nums',
      },
      cell: ({ row }) => {
        const d = durationSecOf(row.original);
        return d == null ? '—' : humanizeDuration(d);
      },
    },
    {
      id: 'created',
      accessorFn: (s) => new Date(s.createdAt).getTime(),
      header: 'Lúc',
      size: 116,
      minSize: 90,
      enableGlobalFilter: false,
      meta: { label: 'Lúc làm', cellClassName: 'whitespace-nowrap text-muted-foreground' },
      cell: ({ row }) => <RelativeTime value={row.original.createdAt} />,
    },
    {
      id: 'actions',
      header: '',
      size: 84,
      minSize: 84,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: { noReorder: true },
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            {/* Stars live on Sentence; a v2 turn has none yet. */}
            {s.kind === 'sentence' && <StarButton id={s.id} starred={s.starred} kind="sentence" />}
            {s.status !== 'PENDING' && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Xem chi tiết lượt dịch"
                aria-haspopup="dialog"
                onClick={() => open(s.id)}
              >
                <Info aria-hidden />
              </Button>
            )}
          </div>
        );
      },
    },
  ];
}

/**
 * The translation timeline in the list template's one shape: cards that load more as they scroll
 * below 1024px, a paged table from 1024px. A turn's detail opens in one dialog the list owns, so
 * a turn graded while the page is open (LiveRefresh) can open it on its own.
 */
export function HistoryTable({
  sentences,
  voiceSpeaker,
  speechRate,
  showFurigana,
}: {
  sentences: HistoryRow[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}) {
  const [filters, setFilters] = useSessionState<Filters>('history.filters', DEFAULT_FILTERS, 'hf');
  const filtered = useMemo(
    () => sentences.filter((s) => matchesFilters(s, filters)),
    [sentences, filters],
  );
  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }));
  const reset = () => setFilters(DEFAULT_FILTERS);

  // `?open=<id>` (a link from elsewhere) opens that turn once, then leaves the URL.
  const router = useRouter();
  const searchParams = useSearchParams();
  const openParam = searchParams.get('open');
  const [openId, setOpenId] = useState<string | null>(() => openParam);
  useEffect(() => {
    if (!openParam) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete('open');
    router.replace(next.size ? `/history?${next}` : '/history', { scroll: false });
  }, [openParam, searchParams, router]);

  // A turn that turns GRADED while the page is open opens by itself.
  const prevStatusRef = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    const prev = prevStatusRef.current;
    if (prev) {
      const fresh = sentences.find((s) => s.status === 'GRADED' && prev.get(s.id) !== 'GRADED');
      if (fresh) setOpenId(fresh.id);
    }
    prevStatusRef.current = new Map(sentences.map((s) => [s.id, s.status]));
  }, [sentences]);

  const prefs = useMemo(
    () => ({ voiceSpeaker, speechRate, showFurigana }),
    [voiceSpeaker, speechRate, showFurigana],
  );
  const cols = useMemo(() => columns(prefs, setOpenId), [prefs]);
  const opened = openId ? sentences.find((s) => s.id === openId) : undefined;

  return (
    <>
      <DataTable
        columns={cols}
        data={filtered}
        getRowId={(s) => s.id}
        persistKey="history"
        // The page has one list, so its search, page and sort keep the plain URL keys (?q=…).
        urlPrefix=""
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
        searchPlaceholder="Tìm trong đề / bài dịch…"
        countNoun="lượt"
        totalCount={sentences.length}
        emptyMessage="Không có lượt dịch nào khớp bộ lọc."
        enableRowNumbers
        onRowClick={(s) => s.status !== 'PENDING' && setOpenId(s.id)}
        filterChips={historyChips(filters, patch)}
        onResetFilters={reset}
        filterSlot={
          <HistoryFilterPopover filters={filters} onPatch={patch} onResetFilters={reset} />
        }
        renderCard={(s) => (
          <HistoryCard
            sentence={s}
            speaker={voiceSpeaker}
            rate={speechRate}
            showFurigana={showFurigana}
            onOpen={() => setOpenId(s.id)}
          />
        )}
      />
      <Dialog open={opened != null} onOpenChange={(o) => !o && setOpenId(null)}>
        {opened && (
          <HistoryDetail
            sentence={opened}
            speaker={voiceSpeaker}
            rate={speechRate}
            showFurigana={showFurigana}
          />
        )}
      </Dialog>
    </>
  );
}
