'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Truncate } from '@/components/ui/truncate';
import { DueCell } from '@/components/common/due-cell';
import { ItemDetailDialog } from '@/components/features/resources/item-detail-dialog';
import { RowActions } from '@/components/features/resources/row-actions';
import { SpokenLine } from '@/components/common/spoken-line';
import { StarButton } from '@/components/common/star-button';
import { buildFuriganaMarkup } from '@/lib/japanese/furigana';
import { formatDateVN, speakable } from '@/lib/core/format';
import { STATE_LABELS } from '@/lib/srs/constants';

export interface ResourceRowBase {
  itemId: string;
  expression: string;
  reading: string | null;
  meaningVi: string;
  notes: string | null;
  level: string;
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

export interface ResourceCellPrefs {
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}

export function expressionColumn<T extends ResourceRowBase>(
  header: string,
  speakLabel: string,
  size: number,
  minSize: number,
  prefs: ResourceCellPrefs,
  toRomaji: (s: string) => string,
): ColumnDef<T> {
  return {
    id: 'expression',
    accessorFn: (r) =>
      `${r.expression} ${r.reading ?? ''} ${toRomaji(r.reading ?? '')} ${toRomaji(r.expression)}`,
    header,
    enableHiding: false,
    size,
    minSize,
    meta: { label: header },
    cell: ({ row }) => {
      const item = row.original;
      return (
        <SpokenLine
          text={item.expression}
          speakText={speakable(item.expression)}
          ruby={buildFuriganaMarkup(item.expression, item.reading)}
          showFurigana={prefs.showFurigana}
          speaker={prefs.voiceSpeaker}
          rate={prefs.speechRate}
          label={speakLabel}
          truncate
        />
      );
    },
  };
}

export function meaningColumn<T extends ResourceRowBase>(size: number): ColumnDef<T> {
  return {
    accessorKey: 'meaningVi',
    header: 'Nghĩa',
    size,
    minSize: 120,
    meta: { label: 'Nghĩa' },
    cell: ({ row }) => <Truncate>{row.original.meaningVi}</Truncate>,
  };
}

const NUM_CELL = 'text-muted-foreground tabular-nums';

export function srsMetaColumns<T extends ResourceRowBase>(dueSize: number): ColumnDef<T>[] {
  return [
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
      size: dueSize,
      minSize: 90,
      enableGlobalFilter: false,
      meta: { label: 'Đến hạn', cellClassName: 'whitespace-nowrap' },
      cell: ({ row }) => <DueCell srs={row.original.srs} />,
    },
    {
      id: 'created',
      accessorFn: (r) => new Date(r.createdAt).getTime(),
      header: 'Ngày thêm',
      size: 124,
      minSize: 90,
      enableGlobalFilter: false,
      meta: { label: 'Ngày thêm', cellClassName: `${NUM_CELL} whitespace-nowrap` },
      cell: ({ row }) => formatDateVN(row.original.createdAt),
    },
    {
      id: 'reps',
      accessorFn: (r) => r.srs?.reps ?? 0,
      header: 'Đã ôn',
      size: 90,
      minSize: 70,
      enableGlobalFilter: false,
      meta: { label: 'Đã ôn (lần)', defaultHidden: true, cellClassName: NUM_CELL },
    },
    {
      id: 'lapses',
      accessorFn: (r) => r.srs?.lapses ?? 0,
      header: 'Quên',
      size: 90,
      minSize: 70,
      enableGlobalFilter: false,
      meta: { label: 'Quên (lần)', defaultHidden: true, cellClassName: NUM_CELL },
    },
    {
      id: 'stability',
      accessorFn: (r) => r.srs?.stability ?? 0,
      header: 'Độ bền',
      size: 110,
      minSize: 80,
      enableGlobalFilter: false,
      meta: { label: 'Độ bền (ngày)', defaultHidden: true, cellClassName: NUM_CELL },
      cell: ({ row }) => (row.original.srs ? (row.original.srs.stability?.toFixed(1) ?? '—') : '—'),
    },
    {
      id: 'difficulty',
      accessorFn: (r) => r.srs?.difficulty ?? 0,
      header: 'Khó FSRS',
      size: 110,
      minSize: 80,
      enableGlobalFilter: false,
      meta: { label: 'Độ khó FSRS', defaultHidden: true, cellClassName: NUM_CELL },
      cell: ({ row }) => (row.original.srs ? (row.original.srs.difficulty?.toFixed(1) ?? '—') : '—'),
    },
  ];
}

export function actionsColumn<T extends ResourceRowBase>(
  kind: 'grammar' | 'vocab',
  detailItem: (row: T) => React.ComponentProps<typeof ItemDetailDialog>['item'],
  prefs: ResourceCellPrefs,
): ColumnDef<T> {
  return {
    id: 'actions',
    header: '',
    size: 120,
    minSize: 108,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    meta: { noReorder: true },
    cell: ({ row }) => {
      const item = row.original;
      return (
        <div className="flex items-center justify-end gap-1">
          <StarButton id={item.itemId} starred={item.starred} kind="item" />
          <ItemDetailDialog
            item={detailItem(item)}
            kind={kind}
            triggerVariant="icon"
            voiceSpeaker={prefs.voiceSpeaker}
            speechRate={prefs.speechRate}
            showFurigana={prefs.showFurigana}
          />
          <RowActions
            item={{
              itemId: item.itemId,
              expression: item.expression,
              reading: item.reading,
              meaningVi: item.meaningVi,
              notes: item.notes,
              ...(kind === 'grammar' ? { level: item.level } : {}),
              suspended: item.suspended,
            }}
            kind={kind}
          />
        </div>
      );
    },
  };
}
