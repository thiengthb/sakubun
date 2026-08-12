'use client';

import { type ReactNode, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Truncate } from '@/components/ui/truncate';
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
import { SpokenLine } from '@/components/shared/spoken-line';
import { StarButton } from '@/components/shared/star-button';
import { useSessionState } from '@/components/shared/use-session-state';
import { CARD_FILTERS, matchesCardFilter } from '@/lib/card-filter';
import { scoreEnrichment } from '@/lib/enrichment-quality';
import { VOCAB_KIND } from '@/lib/item-kinds';
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination';
import { DATE_PRESETS, type DatePreset, speakable, withinDatePreset } from '@/lib/format';
import { JLPT_FILTERS, STAR_FILTERS, STATE_FILTERS } from '@/lib/srs-constants';
import { buildFuriganaMarkup } from '@/lib/furigana';
import { toRomaji } from '@/lib/romaji';
import { cn } from '@/lib/utils';

// Why Claude flagged a word into the inbox. Colored on the same alert→warn→info scale used elsewhere.
const REASON_META: Record<string, { label: string; className: string }> = {
  misused: { label: 'Dùng sai', className: 'border-alert/60 text-alert' },
  unclear: { label: 'Chưa hiểu', className: 'border-warn/60 text-warn' },
  unknown: { label: 'Chưa dùng', className: 'border-info/60 text-info' },
};

const REASON_FILTERS = [
  { value: 'all', label: 'Mọi lý do' },
  { value: 'misused', label: 'Dùng sai' },
  { value: 'unclear', label: 'Chưa hiểu' },
  { value: 'unknown', label: 'Chưa dùng' },
] as const;

export interface VocabRow {
  itemId: string;
  expression: string;
  reading: string | null;
  hanviet: string | null;
  meaningVi: string;
  notes: string | null;
  level: string;
  /**
   * The enrichment card, RAW (2026-08-12). It was absent from this row type entirely, which is why the
   * vocab store had no card-quality filter and its detail dialog could not show a card even after the
   * dialog learned how: the data never reached the component. `listItems` already returns it.
   */
  enrichment: string | null;
  captureReason: string | null;
  suspended: boolean;
  starred: boolean;
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
 * Vocab store table — a thin config over the reusable <DataTable> (mirrors ItemsTable): defines the
 * vocab columns (word + audio + detail-dialog + reason badge, reading, meaning, example, SRS state,
 * due, FSRS analysis fields hidden by default) and the domain filters (state / capture-reason + the
 * due-format toggle). DataTable owns multi-sort, resize, show/hide, search, paging + URL persistence.
 */
export function VocabTable({
  items,
  groups = [],
  actionSlot,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  items: VocabRow[];
  /** Every study group, for the bulk add/remove menus. Narrowed per selection by BulkGroupActions. */
  groups?: GroupSummary[];
  /** Toolbar action (the "Thêm từ" button) — mirrors the grammar table's import slot. */
  actionSlot?: ReactNode;
  voiceSpeaker?: number;
  speechRate?: number;
  /** Render furigana ruby (hover) on the word — from the user's furiganaMode (app/both). */
  showFurigana?: boolean;
}) {
  const [state, setState] = useSessionState<string>('vocab.state', 'all', 'vst');
  const [reason, setReason] = useSessionState<string>('vocab.reason', 'all', 'vr');
  const [star, setStar] = useSessionState<string>('vocab.star', 'all', 'vstar');
  const [level, setLevel] = useSessionState<string>('vocab.level', 'all', 'vlvl');
  const [date, setDate] = useSessionState<DatePreset>('vocab.date', 'all', 'vdt');
  // Own session/URL key (`vcard`), not the grammar table's `card`: the two tables are on the same page
  // and share the query string, so one key would make filtering one store filter the other.
  const [card, setCard] = useSessionState<string>('vocab.card', 'all', 'vcard');

  const filtered = useMemo(
    () =>
      items.filter((it) => {
        if (state === 'suspended') {
          if (!it.suspended) return false;
        } else if (state !== 'all') {
          if (it.suspended || (it.srs?.state ?? 0) !== Number(state)) return false;
        }
        if (reason !== 'all' && it.captureReason !== reason) return false;
        if (star === 'yes' && !it.starred) return false;
        if (level !== 'all' && it.level !== level) return false;
        if (!withinDatePreset(it.createdAt, date)) return false;
        // Scored against the VOCAB bar (collocations + đồng nghĩa/trái nghĩa + ví dụ có dịch), which is
        // a different set of dimensions from the grammar table's — same filter, right yardstick.
        if (!matchesCardFilter(scoreEnrichment(it.enrichment, VOCAB_KIND).tier, card)) return false;
        return true;
      }),
    [items, state, reason, star, level, date, card],
  );

  const columns = useMemo<ColumnDef<VocabRow>[]>(() => {
    const prefs = { voiceSpeaker, speechRate, showFurigana };
    return [
      expressionColumn<VocabRow>('Từ', 'Nghe từ', 190, 130, prefs, toRomaji),
      {
        id: 'captureReason',
        accessorFn: (r) => (r.captureReason ? (REASON_META[r.captureReason]?.label ?? '') : ''),
        header: 'Lý do',
        size: 110,
        minSize: 90,
        meta: { label: 'Lý do bắt được' },
        // Its own column on purpose. The badge used to sit INSIDE the "Từ" cell, glued to the word,
        // which read as though the label were part of the word's name (reported 2026-07-20). The
        // reason is metadata about the capture, not part of the term — so it gets a column, stays
        // filterable, and can be hidden like any other.
        cell: ({ row }) => {
          const reason = row.original.captureReason;
          const meta = reason ? REASON_META[reason] : null;
          if (!meta) return <span className="text-muted-foreground">—</span>;
          return (
            <Badge variant="outline" className={cn('text-xs', meta.className)}>
              {meta.label}
            </Badge>
          );
        },
      },
      {
        id: 'hanviet',
        accessorFn: (r) => r.hanviet ?? '',
        header: 'Hán Việt',
        size: 150,
        minSize: 90,
        meta: { label: 'Âm Hán Việt', defaultHidden: true, cellClassName: 'text-muted-foreground' },
        cell: ({ row }) => (
          <Truncate className="text-muted-foreground capitalize">
            {row.original.hanviet ?? '—'}
          </Truncate>
        ),
      },
      meaningColumn<VocabRow>(200),
      {
        id: 'notes',
        accessorFn: (r) => r.notes ?? '',
        header: 'Ví dụ',
        size: 180,
        minSize: 110,
        meta: { label: 'Ví dụ', cellClassName: 'text-muted-foreground' },
        // Playable in the table too — `truncate` keeps it to one line so the play button does not
        // change the row height, matching how the word itself renders in the first column.
        cell: ({ row }) =>
          row.original.notes ? (
            <SpokenLine
              text={row.original.notes}
              showFurigana={showFurigana}
              speaker={voiceSpeaker}
              rate={speechRate}
              label="Nghe ví dụ"
              truncate
              className="font-normal text-muted-foreground"
            />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      ...srsMetaColumns<VocabRow>(120),
      // Từ vựng đưa `hanviet` vào dialog chi tiết, và KHÔNG đưa `level` (form sửa của từ vựng ẩn ô cấp).
      actionsColumn<VocabRow>(
        'vocab',
        (item) => ({
          expression: item.expression,
          reading: item.reading,
          hanviet: item.hanviet,
          meaningVi: item.meaningVi,
          notes: item.notes,
          enrichment: item.enrichment,
          suspended: item.suspended,
          srs: item.srs,
        }),
        prefs,
      ),
    ];
  }, [voiceSpeaker, speechRate, showFurigana]);

  const filterCount =
    (state !== 'all' ? 1 : 0) +
    (reason !== 'all' ? 1 : 0) +
    (star !== 'all' ? 1 : 0) +
    (card !== 'all' ? 1 : 0) +
    (level !== 'all' ? 1 : 0) +
    (date !== 'all' ? 1 : 0) +
    0;

  return (
    <DataTable
      columns={columns}
      data={filtered}
      getRowId={(r) => r.itemId}
      persistKey="vocab"
      urlPrefix="v"
      pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
      searchPlaceholder="Tìm từ / cách đọc / nghĩa / ví dụ…"
      countNoun="từ"
      totalCount={items.length}
      emptyMessage="Không có từ nào khớp bộ lọc."
      actionSlot={actionSlot}
      // Below md the table becomes a stacked card list (same rows, same pagination) — see DataTable.
      // Two vocab-only slots: âm Hán Việt under the word, and the capture-reason badge in the meta row.
      // Tapping a card opens the item; the ⋮ menu drops its "Chi tiết" entry to match (hideDetail).
      cardHref={(item) => `/resources/${item.itemId}`}
      cardHrefLabel={(item) => `Xem chi tiết từ ${item.expression}`}
      renderCard={(item) => {
        const reasonMeta = item.captureReason ? REASON_META[item.captureReason] : null;
        return (
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
            extra={
              item.hanviet ? (
                // Âm Hán Việt sits BESIDE the word, bracketed and upper-cased — «把握 [BÁ ÁC]» — the
                // convention a Vietnamese learner reads it in. A <span> (not the old block <p>) is what
                // puts it on the word's line: SpokenLine renders inline-flex, so an inline sibling flows
                // next to it and only wraps when the line genuinely runs out of room. No `truncate`
                // here on purpose — it is one or two short syllables, and clipping a 4-character
                // reading to an ellipsis loses the whole point of showing it.
                <span className="ml-1.5 text-xs text-muted-foreground uppercase">
                  [{item.hanviet}]
                </span>
              ) : null
            }
            aside={
              reasonMeta ? (
                <Badge
                  variant="outline"
                  className={cn('px-1.5 py-0 text-xs font-normal', reasonMeta.className)}
                >
                  {reasonMeta.label}
                </Badge>
              ) : null
            }
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
                  kind="vocab"
                // The card itself links to the detail page.
                hideDetail
                />
              </>
            }
          />
        );
      }}
      rowClassName={(r) => (r.suspended ? 'opacity-50' : undefined)}
      enableRowNumbers
      enableRowSelection
      bulkActions={(rows, clear) => {
        const ids = rows.map((r) => r.itemId);
        return (
          <>
            {/* If every selected row is already suspended, offer "Cho học lại"; otherwise "Tạm ngưng". */}
            <BulkSuspendButton
              ids={ids}
              noun="từ vựng"
              suspend={!rows.every((r) => r.suspended)}
              onDone={clear}
            />
            <BulkGroupActions groups={groups} kind="vocab" rows={rows} onDone={clear} />
            <BulkDeleteButton ids={ids} noun="từ vựng" onDone={clear} />
          </>
        );
      }}
      filterSlot={
        <FilterPopover
          activeCount={filterCount}
          onReset={() => {
            setState('all');
            setReason('all');
            setStar('all');
            setLevel('all');
            setDate('all');
            setCard('all');
          }}
        >
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
          {/* Riêng của bảng từ vựng — ngữ pháp không có "lý do bắt được". */}
          <SelectFilterRow
            label="Lý do"
            value={reason}
            onValueChange={setReason}
            options={REASON_FILTERS}
          />
          <SelectFilterRow
            label="Đánh dấu sao"
            value={star}
            onValueChange={setStar}
            options={STAR_FILTERS}
          />
          <SelectFilterRow
            label="Cấp JLPT"
            value={level}
            onValueChange={setLevel}
            options={JLPT_FILTERS}
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
