'use client';

import { Lock, Share2 } from 'lucide-react';
import { BulkActionButton } from '@/components/resources/bulk-action-button';
import { useServerAction } from '@/components/shared/use-server-action';
import { publishItemsAction, unpublishItemsAction } from '@/app/actions';

/**
 * Bulk share/unshare for the resources DataTable selection dock. Only self-authored items are shareable
 * (the caller filters out forks, whose content belongs to their original creator), so `ids` is already
 * narrowed to shareable rows — renders nothing when there are none. `share` picks the direction: true =
 * "Chia sẻ" (publish to the public library), false = "Thu hồi chia sẻ" (back to private). The table
 * shows share unless every shareable row is already public. No confirm dialog — fully reversible.
 */
export function BulkShareButton({
  ids,
  noun,
  share,
  onDone,
}: {
  ids: string[];
  noun: string;
  share: boolean;
  onDone?: () => void;
}) {
  const { run, isPending } = useServerAction(share ? publishItemsAction : unpublishItemsAction, {
    success: (d) => (share ? `Đã chia sẻ ${d.shared} ${noun}` : `Đã thu hồi ${d.shared} ${noun}`),
    onSuccess: () => onDone?.(),
  });
  if (ids.length === 0) return null;

  return (
    <BulkActionButton
      icon={share ? Share2 : Lock}
      label={share ? 'Chia sẻ' : 'Thu hồi chia sẻ'}
      pendingLabel={share ? 'Đang chia sẻ…' : 'Đang thu hồi…'}
      pending={isPending}
      onClick={() => run(ids)}
    />
  );
}
