'use client';

import { useMemo, type ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Truncate } from '@/components/ui/truncate';
import { BulkDeleteButton } from '@/components/resources/bulk-delete-button';
import { BulkGroupActions } from '@/components/resources/bulk-group-button';
import { BulkSuspendButton } from '@/components/resources/bulk-suspend-button';
import { DataTable } from '@/components/shared/data-table';
import { FilterPopover, SelectFilterRow, type FilterOption } from '@/components/shared/filter-popover';
import {
  actionsColumn,
  expressionColumn,
  meaningColumn,
  srsMetaColumns,
} from '@/components/resources/resource-columns';
import { ResourceCard } from '@/components/resources/resource-card';
import { RowActions } from '@/components/resources/row-actions';
import { SpokenLine } from '@/components/shared/spoken-line';
import { StarButton } from '@/components/shared/star-button';
import { useSessionState } from '@/components/shared/use-session-state';
import { CARD_FILTERS, matchesCardFilter } from '@/lib/card-filter';
import { scoreEnrichment } from '@/lib/enrichment-quality';
import { DATE_PRESETS, type DatePreset, speakable, withinDatePreset } from '@/lib/format';
import { buildFuriganaMarkup } from '@/lib/furigana';
import type { GroupSummary } from '@/lib/groups';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/item-kinds';
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination';
import { toRomaji } from '@/lib/romaji';
import { JLPT_FILTERS, STAR_FILTERS, STATE_FILTERS } from '@/lib/srs-constants';
import { cn } from '@/lib/utils';

// One row shape for both kinds, because lib/practice.listItems() returns exactly one shape — it
// selects hanviet and captureReason for grammar rows too, they are simply null there.
export interface ResourceRow {
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
  hanviet?: string | null;
  captureReason?: string | null;
  srs: {
    state: number;
    due: string | Date;
    reps?: number;
    lapses?: number;
    stability?: number;
    difficulty?: number;
  } | null;
}

export type ResourceKind = 'grammar' | 'vocab';

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

// Every filter either kind can offer. `matches` is the predicate; 'all' is always the off value, so
// the active-filter count is just "how many are not 'all'".
const FILTERS = {
  level: {
    label: 'Cấp JLPT',
    options: JLPT_FILTERS,
    matches: (row: ResourceRow, v: string) => row.level === v,
  },
  state: {
    label: 'Trạng thái',
    options: STATE_FILTERS,
    matches: (row: ResourceRow, v: string) =>
      v === 'suspended' ? row.suspended : !row.suspended && (row.srs?.state ?? 0) === Number(v),
  },
  card: {
    label: 'Thẻ chi tiết',
    options: CARD_FILTERS,
    // `kind` is bound per table below; scoreEnrichment needs it to know which dimensions count.
    matches: () => true,
  },
  reason: {
    label: 'Lý do',
    options: REASON_FILTERS,
    matches: (row: ResourceRow, v: string) => row.captureReason === v,
  },
  star: {
    label: 'Đánh dấu sao',
    options: STAR_FILTERS,
    matches: (row: ResourceRow, v: string) => (v === 'yes' ? row.starred : true),
  },
  date: {
    label: 'Ngày thêm',
    options: DATE_PRESETS,
    matches: (row: ResourceRow, v: string) => withinDatePreset(row.createdAt, v as DatePreset),
  },
} satisfies Record<
  string,
  { label: string; options: readonly FilterOption[]; matches: (row: ResourceRow, v: string) => boolean }
>;

type FilterKey = keyof typeof FILTERS;

interface KindConfig {
  itemKind: string;
  persistKey: string;
  urlPrefix: string;
  // Session/url keys are per kind so the two tabs keep independent filter state.
  urlKeys: Record<FilterKey, string>;
  filters: FilterKey[]; // also the order they appear in the popover
  noun: string;
  bulkNoun: string;
  searchPlaceholder: string;
  emptyMessage: string;
  detailLabel: (expression: string) => string;
  columns: (prefs: ResourceCellPrefs) => ColumnDef<ResourceRow>[];
  cardExtra?: (row: ResourceRow) => ReactNode;
  cardAside?: (row: ResourceRow) => ReactNode;
}

interface ResourceCellPrefs {
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}

function reasonBadge(row: ResourceRow, className: string): ReactNode {
  const meta = row.captureReason ? REASON_META[row.captureReason] : null;
  return meta ? (
    <Badge variant="outline" className={cn(className, meta.className)}>
      {meta.label}
    </Badge>
  ) : null;
}

const CONFIG: Record<ResourceKind, KindConfig> = {
  grammar: {
    itemKind: GRAMMAR_KIND,
    persistKey: 'items',
    urlPrefix: '',
    urlKeys: { level: 'lvl', state: 'st', card: 'card', reason: 'rsn', star: 'star', date: 'dt' },
    filters: ['level', 'state', 'card', 'star', 'date'],
    noun: 'mẫu',
    bulkNoun: 'mẫu ngữ pháp',
    searchPlaceholder: 'Tìm mẫu / cách đọc / nghĩa…',
    emptyMessage: 'Không có mẫu nào khớp bộ lọc.',
    detailLabel: (expression) => `Xem chi tiết  ${expression}`,
    columns: (prefs) => [
      expressionColumn<ResourceRow>('Mẫu ngữ pháp', 'Nghe mẫu', 236, 150, prefs, toRomaji),
      meaningColumn<ResourceRow>(220),
      {
        accessorKey: 'level',
        header: 'Cấp',
        size: 76,
        minSize: 76,
        meta: { label: 'Cấp' },
      },
      ...srsMetaColumns<ResourceRow>(130),
      actionsColumn<ResourceRow>(
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
    ],
  },
  vocab: {
    itemKind: VOCAB_KIND,
    persistKey: 'vocab',
    urlPrefix: 'v',
    urlKeys: {
      level: 'vlvl',
      state: 'vst',
      card: 'vcard',
      reason: 'vr',
      star: 'vstar',
      date: 'vdt',
    },
    filters: ['state', 'card', 'reason', 'star', 'level', 'date'],
    noun: 'từ',
    bulkNoun: 'từ vựng',
    searchPlaceholder: 'Tìm từ / cách đọc / nghĩa / ví dụ…',
    emptyMessage: 'Không có từ nào khớp bộ lọc.',
    detailLabel: (expression) => `Xem chi tiết từ ${expression}`,
    columns: (prefs) => [
      expressionColumn<ResourceRow>('Từ', 'Nghe từ', 190, 130, prefs, toRomaji),
      {
        id: 'captureReason',
        accessorFn: (r) => (r.captureReason ? (REASON_META[r.captureReason]?.label ?? '') : ''),
        header: 'Lý do',
        size: 110,
        minSize: 90,
        meta: { label: 'Lý do bắt được' },
        cell: ({ row }) =>
          reasonBadge(row.original, 'text-xs') ?? <span className="text-muted-foreground">—</span>,
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
      meaningColumn<ResourceRow>(200),
      {
        id: 'notes',
        accessorFn: (r) => r.notes ?? '',
        header: 'Ví dụ',
        size: 180,
        minSize: 110,
        meta: { label: 'Ví dụ', cellClassName: 'text-muted-foreground' },
        cell: ({ row }) =>
          row.original.notes ? (
            <SpokenLine
              text={row.original.notes}
              showFurigana={prefs.showFurigana}
              speaker={prefs.voiceSpeaker}
              rate={prefs.speechRate}
              label="Nghe ví dụ"
              truncate
              className="font-normal text-muted-foreground"
            />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      ...srsMetaColumns<ResourceRow>(120),
      actionsColumn<ResourceRow>(
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
    ],
    cardExtra: (row) =>
      row.hanviet ? (
        <span className="ml-1.5 text-xs text-muted-foreground uppercase">[{row.hanviet}]</span>
      ) : null,
    cardAside: (row) => reasonBadge(row, 'px-1.5 py-0 text-xs font-normal'),
  },
};

export function ResourceTable({
  kind,
  items,
  groups = [],
  actionSlot,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  kind: ResourceKind;
  items: ResourceRow[];
  groups?: GroupSummary[];
  actionSlot?: ReactNode;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  const config = CONFIG[kind];

  // One hook call per filter key, in a fixed order — `config.filters` is a module constant, so the
  // set never changes for a given mounted table and the hook order stays stable.
  const level = useSessionState<string>(
    `${config.persistKey}.level`,
    'all',
    config.urlKeys.level,
  );
  const state = useSessionState<string>(`${config.persistKey}.state`, 'all', config.urlKeys.state);
  const card = useSessionState<string>(`${config.persistKey}.card`, 'all', config.urlKeys.card);
  const reason = useSessionState<string>(
    `${config.persistKey}.reason`,
    'all',
    config.urlKeys.reason,
  );
  const star = useSessionState<string>(`${config.persistKey}.star`, 'all', config.urlKeys.star);
  const date = useSessionState<string>(`${config.persistKey}.date`, 'all', config.urlKeys.date);

  const slots: Record<FilterKey, [string, (v: string) => void]> = {
    level,
    state,
    card,
    reason,
    star,
    date,
  };

  // Only the filters this kind offers count; the unused hooks above stay at 'all'.
  const values = config.filters.map((key) => slots[key][0]).join(' ');
  const filterCount = config.filters.filter((key) => slots[key][0] !== 'all').length;

  const filtered = useMemo(
    () =>
      items.filter((row) =>
        config.filters.every((key) => {
          const value = slots[key][0];
          if (value === 'all') return true;
          if (key === 'card') {
            return matchesCardFilter(scoreEnrichment(row.enrichment, config.itemKind).tier, value);
          }
          return FILTERS[key].matches(row, value);
        }),
      ),
    // `values` is the joined filter selection: it changes exactly when the visible rows should be
    // recomputed, which `slots` (a fresh object every render) would not express.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, config, values],
  );

  const columns = useMemo(
    () => config.columns({ voiceSpeaker, speechRate, showFurigana }),
    [config, voiceSpeaker, speechRate, showFurigana],
  );

  return (
    <DataTable
      columns={columns}
      data={filtered}
      getRowId={(r) => r.itemId}
      persistKey={config.persistKey}
      urlPrefix={config.urlPrefix}
      pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
      searchPlaceholder={config.searchPlaceholder}
      countNoun={config.noun}
      totalCount={items.length}
      emptyMessage={config.emptyMessage}
      rowClassName={(r) => (r.suspended ? 'opacity-50' : undefined)}
      actionSlot={actionSlot}
      cardHref={(item) => `/resources/${item.itemId}`}
      cardHrefLabel={(item) => config.detailLabel(item.expression)}
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
          extra={config.cardExtra?.(item)}
          aside={config.cardAside?.(item)}
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
                kind={kind}
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
              noun={config.bulkNoun}
              suspend={!rows.every((r) => r.suspended)}
              onDone={clear}
            />
            <BulkGroupActions groups={groups} kind={kind} rows={rows} onDone={clear} />
            <BulkDeleteButton ids={ids} noun={config.bulkNoun} onDone={clear} />
          </>
        );
      }}
      filterSlot={
        <FilterPopover
          activeCount={filterCount}
          onReset={() => {
            for (const key of config.filters) slots[key][1]('all');
          }}
        >
          {config.filters.map((key) => (
            <SelectFilterRow
              key={key}
              label={FILTERS[key].label}
              value={slots[key][0]}
              onValueChange={slots[key][1]}
              options={FILTERS[key].options}
            />
          ))}
        </FilterPopover>
      }
    />
  );
}
