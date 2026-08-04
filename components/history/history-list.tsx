'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { DataPagination } from '@/components/ui/data-pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { usePagedList } from '@/components/shared/use-paged-list';
import { useSessionState } from '@/components/shared/use-session-state';
import { HistoryCard } from '@/components/history/history-cards';
import {
  DEFAULT_FILTERS,
  HistoryFilters,
  inDatePreset,
  inDurationBucket,
  isFail,
  type Filters,
} from '@/components/history/history-filters';
import { lengthBucket, type LengthBucketKey } from '@/lib/format';
import { cn } from '@/lib/utils';
import { furiganaInApp, type FuriganaMode } from '@/lib/settings-schema';
import type { SentenceHistoryRow } from '@/lib/practice';

export function HistoryList({
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
  const showFurigana = furiganaInApp(furiganaMode);
  // URL-synced + reload-persistent state (best practice, matching the resource tables): the search box
  // and the whole filter set mirror to the address bar (?q / ?hf) via history.replaceState — no server
  // refetch — so a filtered view is shareable + survives F5. Page/size are ephemeral (sessionStorage only).
  const [search, setSearch] = useSessionState('history.search', '', 'q');
  const [filters, setFilters] = useSessionState<Filters>('history.filters', DEFAULT_FILTERS, 'hf');
  const [columns, setColumns] = useSessionState<1 | 2>('history.columns', 2, 'cols');
  // The list + the pagination bar are measured so the page size fills the viewport without a scroll.
  const listRef = useRef<HTMLUListElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sentences.filter((s) => {
      if (filters.direction !== 'all' && s.direction !== filters.direction) return false;
      if (filters.result === 'pass' && (s.ratings.length === 0 || isFail(s))) return false;
      if (filters.result === 'fail' && !isFail(s)) return false;
      if (filters.type !== 'all' && s.exerciseType !== filters.type) return false;
      if (filters.status !== 'all' && s.status !== filters.status) return false;
      if (filters.level !== 'all' && s.level !== filters.level) return false;
      if (
        filters.length !== 'all' &&
        lengthBucket(s.charCount).key !== (filters.length as LengthBucketKey)
      )
        return false;
      if (filters.starred === 'yes' && !s.starred) return false;
      if (filters.scoreMin > 0 || filters.scoreMax < 100) {
        if (typeof s.score !== 'number') return false;
        if (s.score < filters.scoreMin || s.score > filters.scoreMax) return false;
      }
      if (!inDurationBucket(s, filters.duration)) return false;
      if (!inDatePreset(s, filters.datePreset)) return false;
      if (q && !`${s.sourceText} ${s.userAnswer} ${s.suggested ?? ''}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [sentences, search, filters]);

  // Cards estimated ~120px tall; the hook measures the real height once rendered. The grid is 1 or 2
  // columns (the `columns` toggle × the lg breakpoint) — the hook reads the live column count.
  const paged = usePagedList(filtered, {
    topRef: listRef,
    footerRef,
    storeKey: 'history',
    rowHeight: 120,
  });
  const { items: visible, start } = paged;

  // Auto-open the detail modal of a card that JUST got graded while the user is on this tab (Claude
  // grades out of band → LiveRefresh polls → a PENDING row flips to GRADED, or a new GRADED row
  // appears). We track the previous per-id status; the first render seeds the baseline WITHOUT opening
  // anything (so switching to the tab never pops an old card open). This tab unmounts when inactive, so
  // "while on this tab" is implicit. Only one id is armed at a time; a card opens once on the arm.
  const prevStatusRef = useRef<Map<string, string> | null>(null);

  // DEEP LINK — arriving from a notification ("Claude đã chấm xong một câu") lands here as
  // /history?open=<sentenceId>, and that card's modal must be open on ARRIVAL, not after an effect
  // runs. So the param seeds the state directly (lazy initialiser, read once at mount) instead of
  // being copied into state by an effect — which is both a render later and the pattern
  // react-hooks/set-state-in-effect exists to catch.
  const router = useRouter();
  const searchParams = useSearchParams();
  const openParam = searchParams.get('open');
  const [autoOpenId, setAutoOpenId] = useState<string | null>(() => openParam);

  // Strip the param once it has been consumed, so a refresh or a back-navigation does not re-open a
  // modal the learner already closed. This effect only navigates — it sets no state.
  useEffect(() => {
    if (!openParam) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete('open');
    router.replace(next.size ? `/history?${next}` : '/history', { scroll: false });
  }, [openParam, searchParams, router]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    const nowStatus = new Map(sentences.map((s) => [s.id, s.status]));
    if (prev) {
      const fresh = sentences.find((s) => s.status === 'GRADED' && prev.get(s.id) !== 'GRADED');
      if (fresh) setAutoOpenId(fresh.id);
    }
    prevStatusRef.current = nowStatus;
  }, [sentences]);

  const resetPage = () => paged.setPage(1);
  const patch = (p: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...p }));
    resetPage();
  };

  return (
    <div className="space-y-4">
      <HistoryFilters
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          resetPage();
        }}
        filters={filters}
        onPatch={patch}
        onResetFilters={() => {
          setFilters(DEFAULT_FILTERS);
          resetPage();
        }}
        columns={columns}
        onColumnsChange={setColumns}
      />

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="Không có lượt dịch nào khớp bộ lọc." className="py-12" />
      ) : (
        <>
          <ul
            ref={listRef}
            className={cn(
              'grid grid-cols-1 gap-3',
              // Only the large breakpoint splits — below it the cards need the full width regardless.
              columns === 2 && 'lg:grid-cols-2',
            )}
          >
            {visible.map((s) => (
              <HistoryCard
                key={s.id}
                sentence={s}
                speaker={voiceSpeaker}
                rate={speechRate}
                showFurigana={showFurigana}
                autoOpen={s.id === autoOpenId}
              />
            ))}
          </ul>
          {/* Ref on the wrapper (useFitRows measures footer height); the row layout — count, size
              picker and nav, re-ordered per breakpoint — belongs to DataPagination. */}
          <div ref={footerRef}>
            <DataPagination
              count={
                <>
                  {start + 1}–{Math.min(start + paged.pageSize, paged.total)} / {paged.total} lượt
                  {paged.total !== sentences.length && ` (lọc từ ${sentences.length})`}
                </>
              }
              page={paged.page}
              pageCount={paged.pageCount}
              onPageChange={paged.setPage}
              pageSize={paged.pageSize}
              pageSizeOptions={paged.sizeOptions}
              onPageSizeChange={paged.choosePageSize}
              autoFit={paged.autoFit}
              autoFitSize={paged.autoFitSize}
              onAutoFit={paged.onAutoFit}
            />
          </div>
        </>
      )}
    </div>
  );
}
