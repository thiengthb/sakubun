'use client';

import { CirclePause, CirclePlay } from 'lucide-react';
import { BulkActionButton } from '@/components/resources/bulk-action-button';
import { useServerAction } from '@/components/shared/use-server-action';
import { setItemsSuspendedAction } from '@/app/actions';

/**
 * Bulk suspend/resume action for the resources DataTable's selection dock — the reversible sibling of
 * BulkDeleteButton. `suspend` picks the direction: true = "Tạm ngưng" (hide from the review queue),
 * false = "Cho học lại" (bring back). The table decides which to show: if EVERY selected row is already
 * suspended it offers resume, otherwise suspend. No confirm dialog — the action is fully reversible.
 * `onDone` clears the table's selection after success.
 */
export function BulkSuspendButton({
  ids,
  noun,
  suspend,
  onDone,
}: {
  ids: string[];
  noun: string;
  suspend: boolean;
  onDone?: () => void;
}) {
  const { run, isPending } = useServerAction(setItemsSuspendedAction, {
    success: (d) =>
      suspend ? `Đã tạm ngưng ${d.affected} ${noun}` : `Đã cho học lại ${d.affected} ${noun}`,
    onSuccess: () => onDone?.(),
  });

  return (
    <BulkActionButton
      icon={suspend ? CirclePause : CirclePlay}
      label={suspend ? 'Tạm ngưng' : 'Cho học lại'}
      pendingLabel={suspend ? 'Đang tạm ngưng…' : 'Đang cho học lại…'}
      pending={isPending}
      onClick={() => run(ids, suspend)}
    />
  );
}
