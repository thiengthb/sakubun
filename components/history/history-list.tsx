'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { DataPagination } from '@/components/ui/data-pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { usePagedList } from '@/components/shared/use-paged-list';
import { useSessionState } from '@/components/shared/use-session-state';
import { HistoryCard } from '@/components/history/history-cards';
import { HistoryFlashcards } from '@/components/history/history-flashcards';
import {
  DEFAULT_FILTERS,
  HistoryFilters,
  HistoryModeToggle,
  inDatePreset,
  inDurationBucket,
  isFail,
  type Filters,
} from '@/components/history/history-filters';
import { lengthBucket, type LengthBucketKey } from '@/lib/format';
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
  const [search, setSearch] = useSessionState('history.search', '', 'q');
  const [filters, setFilters] = useSessionState<Filters>('history.filters', DEFAULT_FILTERS, 'hf');
  const [mode, setMode] = useSessionState<'list' | 'card'>('history.mode', 'list', 'view');
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

  const paged = usePagedList(filtered, {
    topRef: listRef,
    footerRef,
    storeKey: 'history',
    rowHeight: 120,
  });
  const { items: visible, start } = paged;

  const prevStatusRef = useRef<Map<string, string> | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const openParam = searchParams.get('open');
  const [autoOpenId, setAutoOpenId] = useState<string | null>(() => openParam);

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

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    resetPage();
  };

  const deckMode = mode === 'card' && filtered.length > 0;

  return (
    <div className="space-y-4">
      {!deckMode && (
        <HistoryFilters
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            resetPage();
          }}
          filters={filters}
          onPatch={patch}
          onResetFilters={resetFilters}
          mode={mode}
          onModeChange={setMode}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="Không có lượt dịch nào khớp bộ lọc." className="py-12" />
      ) : mode === 'card' ? (
        <HistoryFlashcards
          sentences={filtered}
          voiceSpeaker={voiceSpeaker}
          speechRate={speechRate}
          showFurigana={showFurigana}
          toolbarStart={<HistoryModeToggle mode={mode} onModeChange={setMode} />}
        />
      ) : (
        <>
          <ul ref={listRef} className="grid grid-cols-1 gap-3 lg:grid-cols-2">
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
