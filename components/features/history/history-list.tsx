'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { PagedFooter } from '@/components/common/paged-footer';
import { EmptyState } from '@/components/common/empty-state';
import { usePagedList } from '@/components/common/use-paged-list';
import { useSessionState } from '@/components/common/use-session-state';
import { HistoryCard } from '@/components/features/history/history-cards';
import {
  DEFAULT_FILTERS,
  HistoryFilters,
  inDatePreset,
  inDurationBucket,
  isFail,
  type Filters,
} from '@/components/features/history/history-filters';
import { lengthBucket, type LengthBucketKey } from '@/lib/core/format';
import { furiganaInApp, type FuriganaMode } from '@/lib/settings/schema';
import type { SentenceHistoryRow } from '@/lib/library/practice';

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
  const { items: visible } = paged;

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
        onResetFilters={resetFilters}
      />

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="Không có lượt dịch nào khớp bộ lọc." className="py-12" />
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
          <PagedFooter
            paged={paged}
            footerRef={footerRef}
            noun="lượt"
            totalUnfiltered={sentences.length}
          />
        </>
      )}
    </div>
  );
}
