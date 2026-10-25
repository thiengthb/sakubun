'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { DataPagination } from '@/components/ui/data-pagination';
import { Dialog } from '@/components/ui/dialog';
import { PAGE_BOTTOM, useFitRows, usePinnedFooter } from '@/components/ui/use-fit-rows';
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

// Every size divides into rows of two and three. By default a page holds as many rows as the
// window does (Tự động), as the tables do.
const PAGE_SIZES = [12, 24, 48, 96];
const CARD_HEIGHT = 112;

/**
 * The translation timeline as cards on every width (thien, Lịch sử round 1): turns differ by
 * direction and exercise type too much to share table columns. Below 1024px the cards load more as
 * they scroll; from 1024px they come in pages (thien, Lịch sử round 2). Both lists are drawn and CSS
 * shows one, so the layout never flips after hydration. The sort sits in the filter popover, as on
 * Nhóm. A turn's detail opens in one dialog the list owns, so a turn graded while the page is open
 * (LiveRefresh) can open it on its own.
 */
const GRID = 'grid grid-cols-1 gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3';

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
  const [pageSize, setPageSize] = useSessionState<number>('history.size', PAGE_SIZES[0], 'size');
  const [autoFit, setAutoFit] = useSessionState<boolean>('history.autofit', true);
  const [pageIndex, setPageIndex] = useSessionState<number>('history.page', 0, 'page');
  // Any change to what the list holds starts it again at page 1.
  const narrow =
    <A extends unknown[]>(set: (...a: A) => void) =>
    (...a: A) => {
      set(...a);
      setPageIndex(0);
    };
  const patch = narrow((p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p })));
  const reset = narrow(() => {
    setFilters(DEFAULT_FILTERS);
    setSort('recent');
  });

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
  // From 1024px the page fills the window with whole rows of cards and its footer rests at the
  // window's bottom, as a table's does (thien, Tài nguyên 2026-10-24 and Lịch sử round 3).
  const pagedRef = useRef<HTMLUListElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const fit = useFitRows({
    topRef: pagedRef,
    footerRef,
    spacerRef,
    rowHeight: CARD_HEIGHT,
    rowGap: 12,
    grid: true,
    bottomGap: PAGE_BOTTOM,
  });
  usePinnedFooter({ footerRef, spacerRef, bottomGap: PAGE_BOTTOM });
  const effectiveSize = autoFit && fit != null ? fit : pageSize;
  const pageCount = Math.max(1, Math.ceil(shown.length / effectiveSize));
  const page = Math.min(pageIndex, pageCount - 1);
  const start = page * effectiveSize;
  const paged = shown.slice(start, start + effectiveSize);

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
  const card = (s: HistoryRow) => (
    <li
      key={s.id}
      className={cn(LIST_CARD.base, 'flex flex-col', s.status !== 'PENDING' && 'hover:bg-muted/40')}
    >
      <HistoryCard
        sentence={s}
        speaker={voiceSpeaker}
        rate={speechRate}
        showFurigana={showFurigana}
        onOpen={() => setOpenId(s.id)}
      />
    </li>
  );

  return (
    <div className="space-y-6">
      <SearchToolbar
        search={
          <SearchInput
            value={q}
            onChange={narrow((e) => setQ(e.target.value))}
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
            onValueChange={narrow((v) => setSort(v as HistorySort))}
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
            <ul data-slot="history-cards" data-layout="scroll" className={cn(GRID, 'lg:hidden')}>
              {items.map(card)}
            </ul>
            <ul
              ref={pagedRef}
              data-slot="history-cards"
              data-layout="pages"
              className={cn(GRID, 'max-lg:hidden')}
            >
              {paged.map(card)}
            </ul>
          </div>
          <ScrollMoreStatus ref={sentinelRef} hasMore={hasMore} className="lg:hidden" />
          <div ref={footerRef} className="max-lg:hidden">
            <div ref={spacerRef} aria-hidden />
            {/* One page needs no footer; the count is in the page header (thien, 2026-10-24). The
                box stays so the fit and the pinned spacer keep measuring it. */}
            {pageCount > 1 && (
              <DataPagination
                count={
                  <>
                    {start + 1}–{start + paged.length} / {shown.length} lượt
                    {shown.length !== sentences.length && ` (lọc từ ${sentences.length})`}
                  </>
                }
                page={page + 1}
                pageCount={pageCount}
                onPageChange={(p) => {
                  setPageIndex(p - 1);
                  window.scrollTo({ top: 0 });
                }}
                pageSize={effectiveSize}
                pageSizeOptions={PAGE_SIZES}
                onPageSizeChange={narrow((size: number) => {
                  setAutoFit(false);
                  setPageSize(size);
                })}
                autoFit={autoFit}
                autoFitSize={fit ?? effectiveSize}
                onAutoFit={narrow(() => setAutoFit(true))}
              />
            )}
          </div>
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
