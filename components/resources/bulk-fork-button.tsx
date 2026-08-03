'use client';

import { Download } from 'lucide-react';
import { BulkActionButton } from '@/components/resources/bulk-action-button';
import { useServerAction } from '@/components/shared/use-server-action';
import { forkItemsAction } from '@/app/actions';

/**
 * Bulk "Lấy về kho" for the /library DataTable selection dock. The caller narrows `ids` to takeable rows
 * (not already-owned, not your own shared item), so this renders nothing when the selection has none.
 * No confirm — forking is additive and reversible (delete from your kho). `forkItems` re-checks each
 * row's own-item + dup guard server-side, so a stale id is skipped, never an error.
 */
export function BulkForkButton({
  ids,
  noun,
  onDone,
}: {
  ids: string[];
  noun: string;
  onDone?: () => void;
}) {
  const { run, isPending } = useServerAction(forkItemsAction, {
    success: (d) => `Đã lấy về ${d.taken} ${noun}`,
    onSuccess: () => onDone?.(),
  });
  if (ids.length === 0) return null;

  return (
    <BulkActionButton
      icon={Download}
      label="Lấy về kho"
      pendingLabel="Đang lấy về…"
      pending={isPending}
      onClick={() => run(ids)}
    />
  );
}
