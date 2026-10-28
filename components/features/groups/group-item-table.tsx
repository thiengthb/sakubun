'use client';

import { useMemo, useTransition, type ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/common/data-table';
import { ItemDetailDialog } from '@/components/common/item-detail-dialog';
import { BulkActionButton } from '@/components/common/bulk-action-button';
import { ResourceCard } from '@/components/common/resource-card';
import {
  expressionColumn,
  meaningColumn,
  srsMetaColumns,
  type ResourceCellPrefs,
  type ResourceRowBase,
} from '@/components/common/item-columns';
import { removeItemsFromGroupAction } from '@/app/actions';
import { toastResult } from '@/lib/core/action-toast';
import { speakable } from '@/lib/core/format';
import { PAGE_SIZE_OPTIONS } from '@/lib/core/pagination';
import { buildFuriganaMarkup } from '@/lib/japanese/furigana';
import { toRomaji } from '@/lib/japanese/romaji';
import type { GroupMemberItem } from '@/lib/library/groups';

type ItemKind = 'grammar' | 'vocab';

interface GroupRow extends ResourceRowBase {
  kind: ItemKind;
  hanviet: string | null;
  enrichment: string | null;
}

const KIND_LABEL: Record<ItemKind, string> = { grammar: 'Ngữ pháp', vocab: 'Từ vựng' };

function toRow(m: GroupMemberItem): GroupRow {
  return {
    itemId: m.itemId,
    expression: m.expression,
    reading: m.reading,
    meaningVi: m.meaningVi ?? '',
    notes: m.notes ?? null,
    level: m.level ?? '—',
    suspended: m.suspended ?? false,
    starred: m.starred ?? false,
    createdAt: m.createdAt ?? new Date(0),
    srs: m.srs ?? null,
    kind: m.kind === 'VOCAB' ? 'vocab' : 'grammar',
    hanviet: m.hanviet ?? null,
    enrichment: m.enrichment ?? null,
  };
}

function DetailButton({ row, prefs }: { row: GroupRow; prefs: ResourceCellPrefs }) {
  return (
    <ItemDetailDialog
      item={{
        expression: row.expression,
        reading: row.reading,
        hanviet: row.hanviet,
        meaningVi: row.meaningVi,
        notes: row.notes,
        level: row.level,
        enrichment: row.enrichment,
        suspended: row.suspended,
        srs: row.srs,
      }}
      kind={row.kind}
      triggerVariant="icon"
      detailHref={`/resources/${row.itemId}`}
      voiceSpeaker={prefs.voiceSpeaker}
      speechRate={prefs.speechRate}
      showFurigana={prefs.showFurigana}
    />
  );
}

function columns(
  mixed: boolean,
  prefs: ResourceCellPrefs,
  rowActions: (row: GroupRow) => ReactNode,
): ColumnDef<GroupRow>[] {
  return [
    expressionColumn<GroupRow>('Mục', 'Nghe', 200, 140, prefs, toRomaji),
    ...(mixed
      ? [
          {
            id: 'kind',
            accessorFn: (r: GroupRow) => KIND_LABEL[r.kind],
            header: 'Loại',
            size: 96,
            minSize: 84,
            meta: { label: 'Loại', cellClassName: 'text-muted-foreground' },
          } satisfies ColumnDef<GroupRow>,
        ]
      : []),
    meaningColumn<GroupRow>(200),
    { accessorKey: 'level', header: 'Cấp', size: 76, minSize: 76, meta: { label: 'Cấp' } },
    ...srsMetaColumns<GroupRow>(110),
    {
      id: 'actions',
      header: '',
      size: 92,
      minSize: 92,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: { noReorder: true },
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">{rowActions(row.original)}</div>
      ),
    },
  ];
}

function useRemove(groupId: string) {
  const [isPending, startTransition] = useTransition();
  const remove = (ids: string[], onDone?: () => void) =>
    startTransition(async () => {
      const r = await removeItemsFromGroupAction(groupId, ids);
      if (toastResult(r, (d) => `Đã gỡ ${d.removed} mục khỏi nhóm`)) onDone?.();
    });
  return { remove, isPending };
}

/**
 * A group's items, or the items that can join it, in the list template's one shape: cards that
 * load more as they scroll below 1024px, a paged table from 1024px. `mode` decides what a row
 * offers: a member can be taken out of the group; a candidate is picked with its checkbox.
 */
export function GroupItemTable({
  mode,
  groupId,
  items,
  mixed,
  onSelectionChange,
  footer,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  mode: 'members' | 'pick';
  groupId: string;
  items: GroupMemberItem[];
  mixed: boolean;
  onSelectionChange?: (ids: string[]) => void;
  /** A picker's footer: DataTable keeps it clear of the pages. */
  footer?: ReactNode;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  const rows = useMemo(() => items.map(toRow), [items]);
  const { remove, isPending } = useRemove(groupId);
  const members = mode === 'members';
  const prefs = useMemo(
    () => ({ voiceSpeaker, speechRate, showFurigana }),
    [voiceSpeaker, speechRate, showFurigana],
  );

  const removeButton = (row: GroupRow) => (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-destructive"
      aria-label={`Gỡ ${row.expression} khỏi nhóm`}
      title="Gỡ khỏi nhóm"
      onClick={() => remove([row.itemId])}
      disabled={isPending}
    >
      <X aria-hidden />
    </Button>
  );

  const cols = useMemo(
    () =>
      columns(mixed, prefs, (row) => (
        <>
          <DetailButton row={row} prefs={prefs} />
          {members && removeButton(row)}
        </>
      )),
    // removeButton closes over isPending only; the columns rebuild when it flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mixed, prefs, members, isPending],
  );

  return (
    <DataTable
      columns={cols}
      data={rows}
      getRowId={(r) => r.itemId}
      persistKey={members ? `group.${groupId}` : 'group-add'}
      urlPrefix={members ? 'g.' : 'ga.'}
      pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
      searchPlaceholder={members ? 'Tìm trong nhóm…' : 'Tìm mẫu / cách đọc / nghĩa…'}
      countNoun="mục"
      totalCount={rows.length}
      emptyMessage="Không có mục nào khớp tìm kiếm."
      rowClassName={(r) => (r.suspended ? 'opacity-50' : undefined)}
      enableRowNumbers
      enableRowSelection
      onSelectionChange={onSelectionChange}
      cardSelection={!members}
      footer={footer}
      cardHref={members ? (r) => `/resources/${r.itemId}` : undefined}
      cardHrefLabel={(r) => `Xem chi tiết ${r.expression}`}
      renderCard={(r) => (
        <ResourceCard
          expression={r.expression}
          ruby={buildFuriganaMarkup(r.expression, r.reading)}
          speakText={speakable(r.expression)}
          meaningVi={r.meaningVi}
          level={r.level}
          suspended={r.suspended}
          srs={r.srs}
          showFurigana={showFurigana}
          voiceSpeaker={voiceSpeaker}
          speechRate={speechRate}
          aside={mixed ? <span className="shrink-0 text-xs">{KIND_LABEL[r.kind]}</span> : undefined}
          actions={members ? removeButton(r) : <DetailButton row={r} prefs={prefs} />}
        />
      )}
      bulkActions={
        members
          ? (selected, clear) => (
              <BulkActionButton
                icon={X}
                label="Gỡ khỏi nhóm"
                pendingLabel="Đang gỡ…"
                pending={isPending}
                onClick={() =>
                  remove(
                    selected.map((r) => r.itemId),
                    clear,
                  )
                }
              />
            )
          : undefined
      }
    />
  );
}
