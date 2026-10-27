'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, MoreHorizontal, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteAccountAction, setBannedAction } from '@/app/admin/actions';
import { toastResult } from '@/lib/core/action-toast';

export type ModeratedAccount = { id: string; email: string; banned: boolean };

/**
 * Ban and delete behind one menu button (roadmap 7.2c), on the account card and the account page.
 * Ban is the default tool: the account and its data stay. Delete asks for the email again.
 */
export function AccountActions({
  account,
  afterDelete,
}: {
  account: ModeratedAccount;
  /** Where to go once the account is gone; the account page passes the list. */
  afterDelete?: string;
}) {
  const router = useRouter();
  const [banOpen, setBanOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [pending, startTransition] = useTransition();
  const { email, banned } = account;

  const toggleBan = () =>
    startTransition(async () => {
      const r = await setBannedAction(account.id, !banned);
      if (toastResult(r, banned ? `Đã bỏ chặn ${email}` : `Đã chặn ${email}`)) setBanOpen(false);
    });

  const confirmDelete = () =>
    startTransition(async () => {
      const r = await deleteAccountAction(account.id, typed);
      if (toastResult(r, `Đã xoá ${email}`)) {
        setDeleteOpen(false);
        setTyped('');
        if (afterDelete) router.push(afterDelete);
      }
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            aria-label={`Tác vụ cho ${email}`}
            disabled={pending}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem onSelect={() => setBanOpen(true)}>
            {banned ? <ShieldCheck aria-hidden /> : <Ban aria-hidden />}
            {banned ? 'Bỏ chặn' : 'Chặn'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden /> Xoá tài khoản
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={banOpen}
        onOpenChange={setBanOpen}
        title={banned ? 'Bỏ chặn tài khoản?' : 'Chặn tài khoản?'}
        description={
          banned
            ? `${email} đăng nhập và học lại được như trước.`
            : `${email} bị đăng xuất ngay, không đăng nhập lại được, và Claude của họ mất quyền. Dữ liệu học vẫn giữ; bỏ chặn lúc nào cũng được.`
        }
        confirmLabel={banned ? 'Bỏ chặn' : 'Chặn'}
        onConfirm={toggleBan}
        pending={pending}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setTyped('');
        }}
        title="Xoá tài khoản?"
        description={`Xoá ${email} cùng toàn bộ dữ liệu học, lịch sử ôn và token MCP. Không thể hoàn tác. Gõ lại email để xác nhận.`}
        confirmLabel="Xoá"
        onConfirm={confirmDelete}
        pending={pending}
      >
        <Input
          aria-label="Email của tài khoản cần xoá"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={email}
          autoComplete="off"
        />
      </ConfirmDialog>
    </>
  );
}
