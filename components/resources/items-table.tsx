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
import { CARD_FILTERS, matchesCardFilter } from '@/lib/card-filter';
import { scoreEnrichment } from '@/lib/enrichment-quality';
import { GRAMMAR_KIND } from '@/lib/item-kinds';
import { buildFuriganaMarkup } from '@/lib/furigana';
import { toRomaji } from '@/lib/romaji';

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

export function ItemsTable({
  items,
  groups = [],
  importSlot,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  items: ItemRow[];
  groups?: GroupSummary[];
  importSlot?: ReactNode;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  const [level, setLevel] = useSessionState<string>('items.level', 'all', 'lvl');
  const [state, setState] = useSessionState<string>('items.state', 'all', 'st');
  const [card, setCard] = useSessionState<string>('items.card', 'all', 'card');
  const [star, setStar] = useSessionState<string>('items.star', 'all', 'star');
  const [date, setDate] = useSessionState<DatePreset>('items.date', 'all', 'dt');

  const filtered = useMemo(
    () =>
      items.filter((it) => {
        if (level !== 'all' && it.level !== level) return false;
        if (!matchesCardFilter(scoreEnrichment(it.enrichment, GRAMMAR_KIND).tier, card)) return false;
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
      expressionColumn<ItemRow>('Mẫu ngữ pháp', 'Nghe mẫu', 236, 150, prefs, toRomaji),
      meaningColumn<ItemRow>(220),
      {
        accessorKey: 'level',
        header: 'Cấp',
        size: 76,
        minSize: 76,
        meta: { label: 'Cấp' },
      },
      ...srsMetaColumns<ItemRow>(130),
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
