'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldBan, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { PageShell } from '@/components/shell/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { RelativeTime } from '@/components/shared/relative-time';
import { UserAvatar } from '@/components/shell/user-avatar';

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  banned: boolean;
  banReason: string | null;
  createdAt: string;
  /** Newest web session's createdAt (each login mints one); null if the user has never logged in. */
  lastLoginAt: string | null;
}

export function AdminView({
  currentUserId,
  users,
}: {
  currentUserId: string;
  users: AdminUserRow[];
}) {
  const router = useRouter();
  const [banTarget, setBanTarget] = useState<AdminUserRow | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onBan() {
    if (!banTarget) return;
    setBusyId(banTarget.id);
    const { error } = await authClient.admin.banUser({
      userId: banTarget.id,
      banReason: reason.trim() || undefined,
    });
    setBusyId(null);
    setBanTarget(null);
    setReason('');
    if (error) return toast.error(error.message ?? 'Không khoá được');
    toast.success('Đã khoá thành viên — web + MCP ngắt ngay');
    router.refresh();
  }

  async function onUnban(u: AdminUserRow) {
    setBusyId(u.id);
    const { error } = await authClient.admin.unbanUser({ userId: u.id });
    setBusyId(null);
    if (error) return toast.error(error.message ?? 'Không bỏ khoá được');
    toast.success('Đã bỏ khoá');
    router.refresh();
  }

  async function onRevoke(u: AdminUserRow) {
    setBusyId(u.id);
    const { error } = await authClient.admin.revokeUserSessions({ userId: u.id });
    setBusyId(null);
    if (error) return toast.error(error.message ?? 'Không thu hồi được');
    toast.success('Đã buộc đăng xuất mọi phiên');
    router.refresh();
  }

  return (
    <PageShell section="admin">
      {/* Title + caveat both live in the breadcrumb (label + hover description). */}
      <ul className="divide-y rounded-lg border">
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          const busy = busyId === u.id;
          return (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar name={u.name || u.email} image={u.image} />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="truncate">{u.name || u.email}</span>
                    {u.role === 'admin' && <Badge variant="secondary">admin</Badge>}
                    {isSelf && <span className="text-xs text-muted-foreground">(bạn)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {u.email}
                    {u.banned && (
                      <span className="text-destructive">
                        {' '}
                        · đã khoá{u.banReason ? ` (${u.banReason})` : ''}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Đăng nhập gần nhất:{' '}
                    {u.lastLoginAt ? (
                      <RelativeTime value={u.lastLoginAt} className="text-foreground" />
                    ) : (
                      <span>chưa đăng nhập</span>
                    )}
                  </p>
                </div>
              </div>

              {!isSelf && (
                <div className="flex items-center gap-2">
                  {u.banned ? (
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => onUnban(u)}>
                      {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                      Bỏ khoá
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => onRevoke(u)}
                        title="Buộc đăng xuất mọi phiên đang mở (không khoá tài khoản)"
                      >
                        Buộc đăng xuất
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          setReason('');
                          setBanTarget(u);
                        }}
                      >
                        <ShieldBan />
                        Khoá
                      </Button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={banTarget !== null}
        onOpenChange={(o) => !o && setBanTarget(null)}
        title={<>Khoá {banTarget?.name || banTarget?.email}?</>}
        description={
          <>
            Thành viên này sẽ bị ngắt web và MCP ngay lập tức. Bạn có thể bỏ khoá sau. Lý do (không
            bắt buộc) sẽ hiển thị trong danh sách.
          </>
        }
        confirmLabel="Khoá thành viên"
        onConfirm={onBan}
        pending={busyId !== null}
      >
        <div className="space-y-2">
          <Label htmlFor="ban-reason">Lý do</Label>
          <Input
            id="ban-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Không bắt buộc"
          />
        </div>
      </ConfirmDialog>
    </PageShell>
  );
}
