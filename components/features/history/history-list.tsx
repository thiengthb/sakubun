'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/empty-state';
import { FilterChips, SelectFilterRow } from '@/components/common/filter-popover';
import { LIST_CARD } from '@/components/common/list-card';
import { ScrollMoreStatus } from '@/components/common/scroll-more-status';
import { SearchInput } from '@/components/common/search-input';
import { SearchToolbar } from '@/components/common/search-toolbar';
import { useScrollMore } from '@/components/common/use-scroll-more';
import { useSessionState } from '@/components/common/use-session-state';
import { HistoryCard, HistoryDetail } from '@/components/features/history/history-cards';
import {
  DEFAULT_FILTERS,
  HistoryFilterPopover,
  historyChips,
  matchesFilters,
  type Filters,
} from '@/components/features/history/history-filters';
import { HISTORY_SORTS, matchesSearch, sortHistory, type HistorySort } from '@/lib/history/order';
import { cn } from '@/lib/core/utils';
import type { HistoryRow } from '@/lib/app/history';

/**
 * The translation timeline as cards on every width (thien, Lịch sử round 1): turns differ by
 * direction and exercise type too much to share table columns. Like Nhóm, the cards load more as
 * they scroll and the sort sits in the filter popover. A turn's detail opens in one dialog the list
 * owns, so a turn graded while the page is open (LiveRefresh) can open it on its own.
 */
export function HistoryList({
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
  // The page has one list, so its search keeps the plain URL key (?q=…).
  const [q, setQ] = useSessionState('history.search', '', 'q');
  const [filters, setFilters] = useSessionState<Filters>('history.filters', DEFAULT_FILTERS, 'hf');
  const [sort, setSort] = useSessionState<HistorySort>('history.sort', 'recent', 'hs');
  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }));
  const reset = () => {
    setFilters(DEFAULT_FILTERS);
    setSort('recent');
  };

  const shown = useMemo(
    () =>
      sortHistory(
        sentences.filter((s) => matchesFilters(s, filters) && matchesSearch(s, q)),
        sort,
      ),
    [sentences, filters, q, sort],
  );
  const { items, hasMore, sentinelRef } = useScrollMore(
    shown,
    JSON.stringify([q.trim(), filters, sort]),
  );

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

  const opened = openId ? sentences.find((s) => s.id === openId) : undefined;

  return (
    <div className="space-y-6">
      <SearchToolbar
        search={
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm trong đề / bài dịch…"
            className="sm:max-w-none"
          />
        }
      >
        <HistoryFilterPopover filters={filters} onPatch={patch} onResetFilters={reset}>
          <SelectFilterRow
            className="col-span-2"
            label="Sắp xếp"
            value={sort}
            onValueChange={(v) => setSort(v as HistorySort)}
            options={HISTORY_SORTS}
          />
        </HistoryFilterPopover>
      </SearchToolbar>

      <FilterChips chips={historyChips(filters, patch)} onReset={reset} className="-mt-3" />

      {shown.length === 0 ? (
        <EmptyState icon={SearchX} title="Không có lượt dịch nào khớp tìm kiếm / bộ lọc." />
      ) : (
        <>
          <div className="@container">
            {/* grid-cols-1 is minmax(0, 1fr): an implicit `auto` track would grow to a card's
                longest unbroken line (a long Vietnamese prompt) and scroll the page sideways. */}
            <ul
              data-slot="history-cards"
              className="grid grid-cols-1 gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3"
            >
              {items.map((s) => (
                <li
                  key={s.id}
                  className={cn(
                    LIST_CARD.base,
                    'flex flex-col',
                    s.status !== 'PENDING' && 'hover:bg-muted/40',
                  )}
                >
                  <HistoryCard
                    sentence={s}
                    speaker={voiceSpeaker}
                    rate={speechRate}
                    showFurigana={showFurigana}
                    onOpen={() => setOpenId(s.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
          <ScrollMoreStatus ref={sentinelRef} hasMore={hasMore} />
        </>
      )}

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
    </div>
  );
}
