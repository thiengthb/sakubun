'use client';

import { useMemo, type ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
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
  /** Library sharing (Phase 3): "private" | "public" — drives the row + bulk share action. */
  visibility: string;
  /** Fork provenance — non-null ⇒ taken from another user ⇒ NOT re-shareable (authorship gate). */
  forkedFromId: string | null;
  srs: {
    state: number;
    due: string | Date;
    reps?: number;
    lapses?: number;
    stability?: number;
    difficulty?: number;
  } | null;
  /** Study-group memberships (group ids) — drives the group filter + bulk remove targeting. */
  groupIds: string[];
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
  importSlot,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  items: ItemRow[];
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

  const columns = useMemo<ColumnDef<ItemRow>[]>(
    () => [
      {
        id: 'expression',
        // accessor drives BOTH sort and global search → include the reading AND its romaji so searching
        // kana OR romaji (e.g. "nagara" for 〜ながら) both surface the pattern.
        accessorFn: (r) =>
          `${r.expression} ${r.reading ?? ''} ${toRomaji(r.reading ?? '')} ${toRomaji(r.expression)}`,
        header: 'Mẫu ngữ pháp',
        enableHiding: false,
        size: 260,
        minSize: 150,
        meta: { label: 'Mẫu ngữ pháp' },
        cell: ({ row }) => {
          const item = row.original;
          // Furigana aligned onto the kanji (handles okurigana: 食べる → 食[た]べる); null when kana-only.
          const ruby = buildFuriganaMarkup(item.expression, item.reading);
          return (
            <SpokenLine
              text={item.expression}
              speakText={speakable(item.expression)}
              ruby={ruby}
              showFurigana={showFurigana}
              speaker={voiceSpeaker}
              rate={speechRate}
              label="Nghe mẫu"
              truncate
            />
          );
        },
      },
      {
        accessorKey: 'meaningVi',
        header: 'Nghĩa',
        size: 220,
        minSize: 120,
        meta: { label: 'Nghĩa' },
        cell: ({ row }) => <Truncate>{row.original.meaningVi}</Truncate>,
      },
      {
        accessorKey: 'level',
        header: 'Level',
        size: 80,
        minSize: 60,
        meta: { label: 'Level' },
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
        size: 130,
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
        // star + quick-look (enrich) sit immediately LEFT of the ⋮ menu — grouped in the action column
        // instead of being scattered. Sharing is an option INSIDE the ⋮ menu (short label + hover
        // title, 2026-07-25); the peek carries the full detail (enrichment card).
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <StarButton id={item.itemId} starred={item.starred} kind="item" />
              <ItemDetailDialog
                item={{
                  expression: item.expression,
                  reading: item.reading,
                  meaningVi: item.meaningVi,
                  notes: item.notes,
                  level: item.level,
                  enrichment: item.enrichment,
                  suspended: item.suspended,
                  srs: item.srs,
                }}
                kind="grammar"
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
                  level: item.level,
                  suspended: item.suspended,
                }}
                kind="grammar"
              />
            </div>
          );
        },
      },
    ],
    [voiceSpeaker, speechRate, showFurigana],
  );

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
          <FilterRow label="Thẻ chi tiết">
            <Select value={card} onValueChange={setCard}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {CARD_FILTERS.map((f) => (
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
