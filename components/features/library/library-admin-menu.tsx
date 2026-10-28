'use client';

import { useRouter } from 'next/navigation';
import { EyeOff, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useServerAction } from '@/components/common/use-server-action';
import { setEntryRemovedAction } from '@/app/admin/actions';

// The admin's tools for one entry or group on its own page (L6, 7.4i), behind one menu and away from
// Thích so Ẩn is never one stray click away: it takes the entry off Kho chung for everyone, then
// goes back to where the entry was listed.
export function LibraryAdminMenu({
  entryId,
  name,
  back,
}: {
  entryId: string;
  name: string;
  /** Where to go once it is hidden: its own page no longer opens. */
  back: string;
}) {
  const router = useRouter();
  const hide = useServerAction(setEntryRemovedAction, {
    success: 'Đã ẩn khỏi Kho chung',
    onSuccess: () => router.push(back),
  });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Quản trị ${name}`}
          disabled={hide.isPending}
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        <DropdownMenuItem onSelect={() => hide.run(entryId, true)}>
          <EyeOff aria-hidden />
          Ẩn khỏi Kho chung
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
