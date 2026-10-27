'use client';

import { useState, useTransition } from 'react';
import { Ban, ShieldCheck, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { LIST_CARD } from '@/components/common/list-card';
import { RelativeTime } from '@/components/common/relative-time';
import { PageShell } from '@/components/layout/page-shell';
import { deleteAccountAction, setBannedAction } from '@/app/admin/actions';
import { toastResult } from '@/lib/core/action-toast';
import { formatDateVN } from '@/lib/core/format';
import { cn } from '@/lib/core/utils';

export type AccountCardRow = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  access: 'admin' | 'learner' | 'none';
  banned: boolean;
  items: number;
  lastReviewAt: string | null;
};

const GRID = 'grid grid-cols-1 gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3';

function StatusBadge({ row }: { row: AccountCardRow }) {
  if (row.banned) return <Badge variant="destructive">Bị chặn</Badge>;
  if (row.access === 'admin') return <Badge variant="secondary">Quản trị</Badge>;
  return <Badge variant="outline">Người học</Badge>;
}

/**
 * Every account, oldest first (roadmap 7.2c). Anyone may sign up, so the admin's tools are to ban
 * (the default: the account and its data stay) and to delete (asks for the email again).
 */
export function AccountsView({ accounts }: { accounts: AccountCardRow[] }) {
  const [banTarget, setBanTarget] = useState<AccountCardRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountCardRow | null>(null);
  const [typed, setTyped] = useState('');
  const [pending, startTransition] = useTransition();

  const toggleBan = (row: AccountCardRow) =>
    startTransition(async () => {
      const r = await setBannedAction(row.id, !row.banned);
      if (toastResult(r, row.banned ? `Đã bỏ chặn ${row.email}` : `Đã chặn ${row.email}`))
        setBanTarget(null);
    });

  const confirmDelete = () => {
    const row = deleteTarget;
    if (!row) return;
    startTransition(async () => {
      const r = await deleteAccountAction(row.id, typed);
      if (toastResult(r, `Đã xoá ${row.email}`)) {
        setDeleteTarget(null);
        setTyped('');
      }
    });
  };

  return (
    <PageShell template="list" title="Quản trị" meta={`${accounts.length} tài khoản`}>
      {accounts.length === 0 ? (
        <EmptyState icon={Users} title="Chưa có tài khoản nào" />
      ) : (
        <div className="@container">
          <ul className={GRID}>
            {accounts.map((row) => (
              <li key={row.id} className={cn(LIST_CARD.base, 'flex flex-col gap-2')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name || row.email}</p>
                    <p className="truncate text-sm text-muted-foreground">{row.email}</p>
                  </div>
                  <StatusBadge row={row} />
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Tạo ngày</dt>
                    <dd>{formatDateVN(row.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Ôn lần cuối</dt>
                    <dd>
                      {row.lastReviewAt ? <RelativeTime value={row.lastReviewAt} /> : 'Chưa ôn'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Số mục</dt>
                    <dd className="tabular-nums">{row.items}</dd>
                  </div>
                </dl>
                {row.access !== 'admin' && (
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setBanTarget(row)} disabled={pending}>
                      {row.banned ? <ShieldCheck aria-hidden /> : <Ban aria-hidden />}
                      {row.banned ? 'Bỏ chặn' : 'Chặn'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Xoá tài khoản ${row.email}`}
                      title="Xoá tài khoản"
                      onClick={() => setDeleteTarget(row)}
                      disabled={pending}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={banTarget !== null}
        onOpenChange={(o) => !o && setBanTarget(null)}
        title={banTarget?.banned ? 'Bỏ chặn tài khoản?' : 'Chặn tài khoản?'}
        description={
          banTarget?.banned
            ? `${banTarget.email} đăng nhập và học lại được như trước.`
            : `${banTarget?.email} bị đăng xuất ngay, không đăng nhập lại được, và Claude của họ mất quyền. Dữ liệu học vẫn giữ; bỏ chặn lúc nào cũng được.`
        }
        confirmLabel={banTarget?.banned ? 'Bỏ chặn' : 'Chặn'}
        onConfirm={() => banTarget && toggleBan(banTarget)}
        pending={pending}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null);
            setTyped('');
          }
        }}
        title="Xoá tài khoản?"
        description={`Xoá ${deleteTarget?.email} cùng toàn bộ dữ liệu học, lịch sử ôn và token MCP. Không thể hoàn tác. Gõ lại email để xác nhận.`}
        confirmLabel="Xoá"
        onConfirm={confirmDelete}
        pending={pending}
      >
        <Input
          aria-label="Email của tài khoản cần xoá"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={deleteTarget?.email}
          autoComplete="off"
        />
      </ConfirmDialog>
    </PageShell>
  );
}
