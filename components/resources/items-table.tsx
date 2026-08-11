'use client';

import { useMemo, type ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { BulkDeleteButton } from '@/components/resources/bulk-delete-button';
import { BulkGroupActions } from '@/components/resources/bulk-group-button';
import type { GroupSummary } from '@/lib/groups';
import { BulkSuspendButton } from '@/components/resources/bulk-suspend-button';
import { DataTable } from '@/components/shared/data-table';
import { FilterPopover, SelectFilterRow } from '@/components/shared/filter-popover';
import {
  actionsColumn,
  expressionColumn,
  meaningColumn,
  srsMetaColumns,
} from '@/components/resources/resource-columns';
import { RowActions } from '@/components/resources/row-actions';
import { ResourceCard } from '@/components/resources/resource-card';
import { StarButton } from '@/components/shared/star-button';
import { useSessionState } from '@/components/shared/use-session-state';
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination';
import { DATE_PRESETS, type DatePreset, speakable, withinDatePreset } from '@/lib/format';
import { JLPT_FILTERS, STAR_FILTERS, STATE_FILTERS } from '@/lib/srs-constants';
import { needsWork, scoreEnrichment } from '@/lib/enrichment-quality';
import { buildFuriganaMarkup } from '@/lib/furigana';
import { toRomaji } from '@/lib/romaji';

// Enrichment-card presence. Surfaced as a filter because a 30% content hole (150 of 153 N5 patterns
// with no card) stayed invisible for weeks: the data was queryable and nothing in the UI asked.
// Widened from a yes/no presence check to the QUALITY tiers (2026-07-27): "has a card" counted a
// one-line card as done forever, so the web disagreed with what the tutor already knew. `needs-work`
// is the one a sweep actually starts from; `broken` is deliberately folded into it rather than given
// its own row (it is rare, and the card itself names the state when you open it).
const CARD_FILTERS = [
  { value: 'all', label: 'Mọi mục' },
  { value: 'needs-work', label: 'Thẻ chưa đạt' },
  { value: 'no', label: 'Chưa có thẻ' },
  { value: 'thin', label: 'Thẻ còn thiếu' },
  { value: 'outdated', label: 'Thẻ format cũ' },
  { value: 'yes', label: 'Thẻ đủ' },
] as const;

export interface ItemRow {
  itemId: string;
  expression: string;
  reading: string | null;
  meaningVi: string;
  notes: string | null;
  level: string;
  suspended: boolean;
  starred: boolean;
  enrichment: string | null;
  createdAt: string | Date;
  /** Ids of the study groups this item belongs to. Present only when the loader asked for it
   *  (`listItems({ withGroupIds: true })`) — the resources page does; other callers do not. */
  groupIds?: string[];
  srs: {
    state: number;
    due: string | Date;
    reps?: number;
    lapses?: number;
    stability?: number;
    difficulty?: number;
  } | null;
}

/**
 * Grammar store table — now a thin config over the reusable <DataTable> (TanStack): it defines the
 * COLUMNS (with custom cells: audio + detail-dialog, truncated meaning, SRS state, due, FSRS analysis
 * fields hidden by default) and the domain FILTERS (level / state, + the due-format display toggle),
 * pre-filtering the rows; DataTable owns multi-sort, resizable columns, show/hide columns, global
 * search, pagination, and the URL/session persistence of all of that.
 */
export function ItemsTable({
  items,
  groups = [],
  importSlot,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  items: ItemRow[];
  /** Every study group, for the bulk add/remove menus. Narrowed per selection by BulkGroupActions. */
  groups?: GroupSummary[];
  importSlot?: ReactNode;
  voiceSpeaker?: number;
  speechRate?: number;
  /** Render furigana ruby (hover) on the pattern — from the user's furiganaMode (app/both). */
  showFurigana?: boolean;
}) {
  // Domain filters live in the app (rendered in the FilterPopover) and pre-filter the rows; they keep
  // their own sessionStorage+URL persistence (?lvl/?st/?due). Sort/search/page/columns/widths are
  // owned + persisted by <DataTable>.
  const [level, setLevel] = useSessionState<string>('items.level', 'all', 'lvl');
  const [state, setState] = useSessionState<string>('items.state', 'all', 'st');
  const [card, setCard] = useSessionState<string>('items.card', 'all', 'card');
  const [star, setStar] = useSessionState<string>('items.star', 'all', 'star');
  const [date, setDate] = useSessionState<DatePreset>('items.date', 'all', 'dt');

  const filtered = useMemo(
    () =>
      items.filter((it) => {
        if (level !== 'all' && it.level !== level) return false;
        if (card !== 'all') {
          const tier = scoreEnrichment(it.enrichment).tier;
          if (card === 'no' && tier !== 'missing') return false;
          if (card === 'thin' && tier !== 'thin') return false;
          if (card === 'outdated' && tier !== 'outdated') return false;
          if (card === 'needs-work' && !needsWork(tier)) return false;
          // "Thẻ đủ" = actually good, not merely present — the distinction this filter now draws.
          if (card === 'yes' && needsWork(tier)) return false;
        }
        if (star === 'yes' && !it.starred) return false;
        if (!withinDatePreset(it.createdAt, date)) return false;
        if (state === 'suspended') return it.suspended;
        if (state !== 'all') return !it.suspended && (it.srs?.state ?? 0) === Number(state);
        return true;
      }),
    [items, level, state, card, star, date],
  );

  const columns = useMemo<ColumnDef<ItemRow>[]>(() => {
    const prefs = { voiceSpeaker, speechRate, showFurigana };
    return [
      // 236 thay vì 260 (2026-08-11): chỗ 24px này là chỗ bù cho "Cấp" và "Ngày thêm" rộng ra, để tổng
      // bề rộng cột vẫn nằm trong khung ở 1440px và bảng không sinh thanh cuộn ngang chỉ để cuộn ~14px.
      // Cột này còn dư nhiều nhất: chữ tiêu đề chỉ cần 144px, phần còn lại là chỗ cho mẫu dài.
      expressionColumn<ItemRow>('Mẫu ngữ pháp', 'Nghe mẫu', 236, 150, prefs, toRomaji),
      meaningColumn<ItemRow>(220),
      {
        // "Cấp", không phải "Level" (đổi 2026-08-11). Hai lý do, và cái thứ hai mới là lý do thật:
        //   1. Nó là tiêu đề DUY NHẤT còn tiếng Anh giữa Nghĩa · Trạng thái · Đến hạn · Ngày thêm · Đã
        //      ôn · Quên · Độ bền — mà AGENTS.md nói mọi chuỗi người học đọc trên UI là tiếng Việt.
        //   2. Ở 80px, ô tiêu đề còn phải chứa tay kéo cột + nút sắp xếp, nên "Level" bị cắt thành
        //      "Le…" (chụp được ở 1440px).
        // Bề rộng 76px là ĐO, không phải đoán: ô tiêu đề mất đúng 48px cho tay kéo + nút sắp xếp +
        // đệm, và chữ "Cấp" cần 27px → 75px là sàn. (Lần đầu tôi đặt 64px để lấy lại bề rộng cho cả
        // bảng và nó cắt thành "C." — hẹp hơn sàn thì chữ nào cũng chết.)
        accessorKey: 'level',
        header: 'Cấp',
        size: 76,
        minSize: 76,
        meta: { label: 'Cấp' },
      },
      ...srsMetaColumns<ItemRow>(130),
      // Ngữ pháp đưa `level` + `enrichment` vào dialog chi tiết (thẻ chi tiết là của riêng nó).
      actionsColumn<ItemRow>(
        'grammar',
        (item) => ({
          expression: item.expression,
          reading: item.reading,
          meaningVi: item.meaningVi,
          notes: item.notes,
          level: item.level,
          enrichment: item.enrichment,
          suspended: item.suspended,
          srs: item.srs,
        }),
        prefs,
      ),
    ];
  }, [voiceSpeaker, speechRate, showFurigana]);

  const filterCount =
    (level !== 'all' ? 1 : 0) +
    (state !== 'all' ? 1 : 0) +
    (card !== 'all' ? 1 : 0) +
    (star !== 'all' ? 1 : 0) +
    (date !== 'all' ? 1 : 0) +
    0;

  return (
    <DataTable
      columns={columns}
      data={filtered}
      getRowId={(r) => r.itemId}
      persistKey="items"
      urlPrefix=""
      pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
      searchPlaceholder="Tìm mẫu / cách đọc / nghĩa…"
      countNoun="mẫu"
      totalCount={items.length}
      emptyMessage="Không có mẫu nào khớp bộ lọc."
      rowClassName={(r) => (r.suspended ? 'opacity-50' : undefined)}
      actionSlot={importSlot}
      // Below md the table becomes a stacked card list (same rows, same pagination) — see DataTable.
      // Tapping a card opens the item; the ⋮ menu drops its "Chi tiết" entry to match (hideDetail).
      cardHref={(item) => `/resources/${item.itemId}`}
      cardHrefLabel={(item) => `Xem chi tiết  ${item.expression}`}
      renderCard={(item) => (
        <ResourceCard
          expression={item.expression}
          ruby={buildFuriganaMarkup(item.expression, item.reading)}
          speakText={speakable(item.expression)}
          meaningVi={item.meaningVi}
          level={item.level}
          suspended={item.suspended}
          srs={item.srs ?? null}
          showFurigana={showFurigana}
          voiceSpeaker={voiceSpeaker}
          speechRate={speechRate}
          actions={
            <>
              <StarButton id={item.itemId} starred={item.starred} kind="item" />
              <RowActions
                item={{
                  itemId: item.itemId,
                  expression: item.expression,
                  reading: item.reading,
                  meaningVi: item.meaningVi,
                  notes: item.notes,
                  level: item.level,
                  suspended: item.suspended,
                }}
                kind="grammar"
                // The card itself links to the detail page.
                hideDetail
              />
            </>
          }
        />
      )}
      enableRowNumbers
      enableRowSelection
      bulkActions={(rows, clear) => {
        const ids = rows.map((r) => r.itemId);
        return (
          <>
            {/* If every selected row is already suspended, offer "Cho học lại"; otherwise "Tạm ngưng". */}
            <BulkSuspendButton
              ids={ids}
              noun="mẫu ngữ pháp"
              suspend={!rows.every((r) => r.suspended)}
              onDone={clear}
            />
            <BulkGroupActions groups={groups} kind="grammar" rows={rows} onDone={clear} />
            <BulkDeleteButton ids={ids} noun="mẫu ngữ pháp" onDone={clear} />
          </>
        );
      }}
      filterSlot={
        <FilterPopover
          activeCount={filterCount}
          onReset={() => {
            setLevel('all');
            setState('all');
            setCard('all');
            setStar('all');
            setDate('all');
          }}
        >
          <SelectFilterRow
            label="Cấp JLPT"
            value={level}
            onValueChange={setLevel}
            options={JLPT_FILTERS}
          />
          <SelectFilterRow
            label="Trạng thái"
            value={state}
            onValueChange={setState}
            options={STATE_FILTERS}
          />
          {/* Riêng của bảng ngữ pháp — từ vựng không có thẻ chi tiết. */}
          <SelectFilterRow
            label="Thẻ chi tiết"
            value={card}
            onValueChange={setCard}
            options={CARD_FILTERS}
          />
          <SelectFilterRow
            label="Đánh dấu sao"
            value={star}
            onValueChange={setStar}
            options={STAR_FILTERS}
          />
          <SelectFilterRow
            label="Ngày thêm"
            value={date}
            onValueChange={(v) => setDate(v as DatePreset)}
            options={DATE_PRESETS}
          />
        </FilterPopover>
      }
    />
  );
}
