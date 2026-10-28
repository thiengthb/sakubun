'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchX } from 'lucide-react';
import { Explain } from '@/components/common/explain';
import { EmptyState } from '@/components/common/empty-state';
import { FilterChips, SelectFilterRow } from '@/components/common/filter-popover';
import { LIST_CARD } from '@/components/common/list-card';
import { ScrollMoreStatus } from '@/components/common/scroll-more-status';
import { SearchInput } from '@/components/common/search-input';
import { SearchToolbar } from '@/components/common/search-toolbar';
import { useScrollMore } from '@/components/common/use-scroll-more';
import { useSessionState } from '@/components/common/use-session-state';
import { HistoryDetailPanel } from '@/components/features/history/history-detail';
import { HistoryTimelineRow } from '@/components/features/history/history-row';
import { TONE } from '@/components/features/history/history-shared';
import {
  DEFAULT_FILTERS,
  HistoryFilterPopover,
  historyChips,
  matchesFilters,
  type Filters,
} from '@/components/features/history/history-filters';
import { groupByDay, type HistoryDay } from '@/lib/history/days';
import { HISTORY_SORTS, matchesSearch, sortHistory, type HistorySort } from '@/lib/history/order';
import type { ResultTone } from '@/lib/history/result';
import type { HistoryRow } from '@/lib/app/history';
import { cn } from '@/lib/core/utils';

/**
 * The translation timeline (thien, 7.4 History B): the turns gathered by day, each day a box of
 * two-line rows with a bar of how its results came out. It loads more as it scrolls at every width.
 * Sorted by result, the days would only break the order apart, so the rows stand in one box. A
 * turn's detail opens in a side panel the list owns, so a turn graded while the page is open
 * (LiveRefresh) can open it on its own.
 */

const BAR_ORDER: { tone: ResultTone; label: string }[] = [
  { tone: 'alert', label: 'Again hoặc dưới 50' },
  { tone: 'warn', label: 'Hard hoặc 50–69' },
  { tone: 'ok', label: 'Good hoặc 70–89' },
  { tone: 'info', label: 'Easy hoặc từ 90' },
  { tone: 'muted', label: 'Bỏ qua' },
];

function DayBar({ tally }: { tally: HistoryDay<HistoryRow>['tally'] }) {
  const parts = BAR_ORDER.filter((p) => tally[p.tone] > 0);
  if (parts.length === 0) return null;
  const text = parts.map((p) => `${p.label}: ${tally[p.tone]}`).join(' · ');
  return (
    <Explain text={text}>
      <span
        role="img"
        aria-label={text}
        className="ml-auto flex h-2 w-28 shrink-0 overflow-hidden rounded-full bg-muted"
      >
        {parts.map((p) => (
          <span key={p.tone} className={TONE[p.tone].bar} style={{ flex: tally[p.tone] }} />
        ))}
      </span>
    </Explain>
  );
}

// A day's turns in one raised box, a rule between rows.
const BOX = cn(LIST_CARD.base, 'divide-y divide-border overflow-hidden bg-card p-0');

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
  const byDay = sort === 'recent' || sort === 'oldest';
  const days = useMemo(() => (byDay ? groupByDay(items) : null), [byDay, items]);

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

  // The panel steps through what the timeline shows, in its order; a turn opened from a link that
  // the filters hide still opens, on its own.
  const openable = useMemo(() => {
    const list = shown.filter((s) => s.status !== 'PENDING');
    const linked = openId ? sentences.find((s) => s.id === openId) : undefined;
    return linked && !list.includes(linked) ? [linked] : list;
  }, [shown, sentences, openId]);
  // Stepping to a row further down than the list has loaded scrolls it into view.
  const openTurn = useCallback((id: string) => {
    setOpenId(id);
    requestAnimationFrame(() =>
      document.querySelector(`[data-history-row="${id}"]`)?.scrollIntoView({ block: 'nearest' }),
    );
  }, []);

  const row = (s: HistoryRow) => (
    <li key={s.id}>
      <HistoryTimelineRow
        sentence={s}
        selected={s.id === openId}
        showFurigana={showFurigana}
        speaker={voiceSpeaker}
        rate={speechRate}
        onOpen={() => openTurn(s.id)}
      />
    </li>
  );

  return (
    // With furigana on, the readings in Lịch sử show without a hover (thien, 7.4).
    // While a turn is open on a laptop the list makes room for the panel, so no row hides under it.
    <div
      className={cn(
        'space-y-6',
        showFurigana && '[&_.furigana_rt]:visible',
        openId && 'lg:pr-108',
      )}
    >
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
        <div data-slot="history-timeline" className="space-y-1">
          {days ? (
            days.map((day, i) => (
              <Fragment key={`${day.key}-${i}`}>
                <div className="flex items-baseline gap-2.5 pt-2 pb-1.5 first:pt-0">
                  <h2 className="shrink-0 text-sm font-semibold">{day.label}</h2>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {day.rows.length} lượt
                    {day.tally.ok + day.tally.info > 0 &&
                      ` · ${day.tally.ok + day.tally.info} Good trở lên`}
                  </span>
                  <DayBar tally={day.tally} />
                </div>
                <ul data-slot="history-day" className={BOX}>
                  {day.rows.map(row)}
                </ul>
              </Fragment>
            ))
          ) : (
            <ul data-slot="history-day" className={BOX}>
              {items.map(row)}
            </ul>
          )}
          <ScrollMoreStatus ref={sentinelRef} hasMore={hasMore} />
        </div>
      )}

      <HistoryDetailPanel
        rows={openable}
        openId={openId}
        onOpen={openTurn}
        onClose={() => setOpenId(null)}
        speaker={voiceSpeaker}
        rate={speechRate}
        showFurigana={showFurigana}
      />
    </div>
  );
}
