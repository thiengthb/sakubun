'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { ItemDetailDialog } from '@/components/common/item-detail-dialog';
import type { ResourceCellPrefs, ResourceRowBase } from '@/components/common/item-columns';
import { RowActions } from '@/components/features/resources/row-actions';
import { StarButton } from '@/components/common/star-button';

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
