'use client';

import { type ReactNode, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Truncate } from '@/components/ui/truncate';
import { BulkDeleteButton } from '@/components/resources/bulk-delete-button';
import { BulkSuspendButton } from '@/components/resources/bulk-suspend-button';
import { DataTable } from '@/components/shared/data-table';
import { FilterPopover, FilterRow } from '@/components/shared/filter-popover';
import { ItemDetailDialog } from '@/components/resources/item-detail-dialog';
import { RowActions } from '@/components/resources/row-actions';
import { ResourceCard } from '@/components/resources/resource-card';
import { SpokenLine } from '@/components/shared/spoken-line';
import { StarButton } from '@/components/shared/star-button';
import { DueCell } from '@/components/shared/due-cell';
import { useSessionState } from '@/components/shared/use-session-state';
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination';
import { JLPT_LEVELS } from '@/lib/settings-schema';
import {
  DATE_PRESETS,
  type DatePreset,
  formatDateVN,
  speakable,
  withinDatePreset,
} from '@/lib/format';
import { STAR_FILTERS, STATE_FILTERS, STATE_LABELS } from '@/lib/srs-constants';
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
  captureReason: string | null;
  suspended: boolean;
  starred: boolean;
  createdAt: string | Date;
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
  actionSlot,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  items: VocabRow[];
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
        return true;
      }),
    [items, state, reason, star, level, date],
  );

  const columns = useMemo<ColumnDef<VocabRow>[]>(
    () => [
      {
        id: 'expression',
        // Search matches the word, its kana reading, AND romaji of both (so "takai" finds 高い).
        accessorFn: (r) =>
          `${r.expression} ${r.reading ?? ''} ${toRomaji(r.reading ?? '')} ${toRomaji(r.expression)}`,
        header: 'Từ',
        enableHiding: false,
        size: 190,
        minSize: 130,
        meta: { label: 'Từ' },
        cell: ({ row }) => {
          const item = row.original;
          // Furigana aligned onto the kanji (handles okurigana: 高い → 高[たか]い); null when kana-only.
          const ruby = buildFuriganaMarkup(item.expression, item.reading);
          return (
            <SpokenLine
              text={item.expression}
              speakText={speakable(item.expression)}
              ruby={ruby}
              showFurigana={showFurigana}
              speaker={voiceSpeaker}
              rate={speechRate}
              label="Nghe từ"
              truncate
            />
          );
        },
      },
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
      {
        accessorKey: 'meaningVi',
        header: 'Nghĩa',
        size: 200,
        minSize: 120,
        meta: { label: 'Nghĩa' },
        cell: ({ row }) => <Truncate>{row.original.meaningVi}</Truncate>,
      },
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
      {
        id: 'state',
        accessorFn: (r) => (r.suspended ? 99 : (r.srs?.state ?? 0)),
        header: 'Trạng thái',
        size: 120,
        minSize: 90,
        enableGlobalFilter: false,
        meta: { label: 'Trạng thái' },
        cell: ({ row }) => {
          const item = row.original;
          return item.suspended ? (
            <span className="text-muted-foreground">Tạm ngưng</span>
          ) : (
            (STATE_LABELS[item.srs?.state ?? 0] ?? '—')
          );
        },
      },
      {
        id: 'due',
        accessorFn: (r) => (r.srs && r.srs.state !== 0 ? new Date(r.srs.due).getTime() : Infinity),
        header: 'Đến hạn',
        size: 120,
        minSize: 90,
        enableGlobalFilter: false,
        meta: { label: 'Đến hạn', cellClassName: 'whitespace-nowrap' },
        cell: ({ row }) => <DueCell srs={row.original.srs} />,
      },
      {
        id: 'created',
        accessorFn: (r) => new Date(r.createdAt).getTime(),
        header: 'Ngày thêm',
        size: 120,
        minSize: 90,
        enableGlobalFilter: false,
        meta: {
          label: 'Ngày thêm',
          cellClassName: 'text-muted-foreground tabular-nums whitespace-nowrap',
        },
        cell: ({ row }) => formatDateVN(row.original.createdAt),
      },
      {
        id: 'reps',
        accessorFn: (r) => r.srs?.reps ?? 0,
        header: 'Đã ôn',
        size: 90,
        minSize: 70,
        enableGlobalFilter: false,
        meta: {
          label: 'Đã ôn (lần)',
          defaultHidden: true,
          cellClassName: 'text-muted-foreground tabular-nums',
        },
      },
      {
        id: 'lapses',
        accessorFn: (r) => r.srs?.lapses ?? 0,
        header: 'Quên',
        size: 90,
        minSize: 70,
        enableGlobalFilter: false,
        meta: {
          label: 'Quên (lần)',
          defaultHidden: true,
          cellClassName: 'text-muted-foreground tabular-nums',
        },
      },
      {
        id: 'stability',
        accessorFn: (r) => r.srs?.stability ?? 0,
        header: 'Độ bền',
        size: 110,
        minSize: 80,
        enableGlobalFilter: false,
        meta: {
          label: 'Độ bền (ngày)',
          defaultHidden: true,
          cellClassName: 'text-muted-foreground tabular-nums',
        },
        cell: ({ row }) =>
          row.original.srs ? (row.original.srs.stability?.toFixed(1) ?? '—') : '—',
      },
      {
        id: 'difficulty',
        accessorFn: (r) => r.srs?.difficulty ?? 0,
        header: 'Khó FSRS',
        size: 110,
        minSize: 80,
        enableGlobalFilter: false,
        meta: {
          label: 'Độ khó FSRS',
          defaultHidden: true,
          cellClassName: 'text-muted-foreground tabular-nums',
        },
        cell: ({ row }) =>
          row.original.srs ? (row.original.srs.difficulty?.toFixed(1) ?? '—') : '—',
      },
      {
        id: 'actions',
        header: '',
        // Sized for exactly 3 size-8 icon buttons (~104px content) so justify-end sits them flush with
        // no dead space — was 200/176 back when a labelled share BUTTON lived here (2026-07-25).
        size: 120,
        minSize: 108,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        meta: { noReorder: true },
        // star + quick-look (enrich) sit immediately LEFT of the ⋮ menu, matching the grammar table.
        // Sharing is an option INSIDE the ⋮ menu (short label + hover title, 2026-07-25).
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <StarButton id={item.itemId} starred={item.starred} kind="item" />
              <ItemDetailDialog
                item={{
                  expression: item.expression,
                  reading: item.reading,
                  hanviet: item.hanviet,
                  meaningVi: item.meaningVi,
                  notes: item.notes,
                  suspended: item.suspended,
                  srs: item.srs,
                }}
                kind="vocab"
                triggerVariant="icon"
                voiceSpeaker={voiceSpeaker}
                speechRate={speechRate}
                showFurigana={showFurigana}
              />
              <RowActions
                item={{
                  itemId: item.itemId,
                  expression: item.expression,
                  reading: item.reading,
                  meaningVi: item.meaningVi,
                  notes: item.notes,
                  suspended: item.suspended,
                }}
                kind="vocab"
              />
            </div>
          );
        },
      },
    ],
    [voiceSpeaker, speechRate, showFurigana],
  );

  const filterCount =
    (state !== 'all' ? 1 : 0) +
    (reason !== 'all' ? 1 : 0) +
    (star !== 'all' ? 1 : 0) +
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
          }}
        >
          <FilterRow label="Trạng thái">
            <Select value={state} onValueChange={setState}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {STATE_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterRow>
          <FilterRow label="Lý do">
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {REASON_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterRow>
          <FilterRow label="Đánh dấu sao">
            <Select value={star} onValueChange={setStar}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {STAR_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterRow>
          <FilterRow label="Cấp JLPT">
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="all">Mọi cấp</SelectItem>
                {JLPT_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterRow>
          <FilterRow label="Ngày thêm">
            <Select value={date} onValueChange={(v) => setDate(v as DatePreset)}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {DATE_PRESETS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterRow>
        </FilterPopover>
      }
    />
  );
}
