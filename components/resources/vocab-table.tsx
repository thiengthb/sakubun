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
  enrichment: string | null;
  captureReason: string | null;
  suspended: boolean;
  starred: boolean;
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

export function VocabTable({
  items,
  groups = [],
  actionSlot,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  items: VocabRow[];
  groups?: GroupSummary[];
  actionSlot?: ReactNode;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  const [state, setState] = useSessionState<string>('vocab.state', 'all', 'vst');
  const [reason, setReason] = useSessionState<string>('vocab.reason', 'all', 'vr');
  const [star, setStar] = useSessionState<string>('vocab.star', 'all', 'vstar');
  const [level, setLevel] = useSessionState<string>('vocab.level', 'all', 'vlvl');
  const [date, setDate] = useSessionState<DatePreset>('vocab.date', 'all', 'vdt');
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
