'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  Check,
  Copy,
  KeyRound,
  Loader2,
  LogIn,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth/auth-client';
import { createMcpKeyAction, revokeMcpKeyAction } from '@/app/settings/actions';
import { UserAvatar } from '@/components/layout/user-avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsTab } from '@/components/features/settings/settings-tab';
import { SettingsSection } from '@/components/features/settings/settings-section';
import { SettingRow } from '@/components/features/settings/setting-row';
import { IconTile } from '@/components/common/icon-tile';
import { McpUsageCard } from '@/components/features/settings/mcp-usage-card';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { CopyCommandButton } from '@/components/common/copy-command-button';
import { APP_TIME_ZONE, formatDateTimeVN, formatDateVN } from '@/lib/core/format';
import type { ToolUsageReport } from '@/lib/mcp/usage';

function claudeDesktopConfig(token: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `{
  "mcpServers": {
    "sakubun": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote", "${origin}/api/mcp",
        "--header", "Authorization: Bearer ${token}"
      ]
    }
  }
}`;
}

function mcpEndpoint(): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/api/mcp`;
}

export interface McpKeyRow {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const MIN_PASSWORD = 8;

export function AccountTab({
  name,
  email,
  image,
  hasPassword,
  joinedAt,
  lastLoginAt,
  keys,
  mcpUsage,
  isAdmin,
}: {
  name: string;
  email: string;
  image: string | null;
  hasPassword: boolean;
  joinedAt: string | null;
  lastLoginAt: string | null;
  keys: McpKeyRow[];
  // Whole-app tool statistics: admin only (roadmap 7.2), null for a learner.
  mcpUsage: ToolUsageReport | null;
  isAdmin: boolean;
}) {
  const router = useRouter();

  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<McpKeyRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [savedName, setSavedName] = useState(name);
  const [displayName, setDisplayName] = useState(name);
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const trimmedName = displayName.trim();
  const nameDirty = trimmedName.length > 0 && trimmedName !== savedName;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  function startEditName() {
    setDisplayName(savedName);
    setEditingName(true);
  }

  function cancelEditName() {
    setDisplayName(savedName);
    setEditingName(false);
  }

  async function onSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!nameDirty) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    const { error } = await authClient.updateUser({ name: trimmedName });
    setSavingName(false);
    if (error) {
      toast.error(error.message ?? 'Không cập nhật được tên');
      return;
    }
    setSavedName(trimmedName);
    setDisplayName(trimmedName);
    setEditingName(false);
    toast.success('Đã cập nhật tên hiển thị');
    router.refresh();
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < MIN_PASSWORD) {
      toast.error(`Mật khẩu mới cần ít nhất ${MIN_PASSWORD} ký tự`);
      return;
    }
    setChangingPassword(true);
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: false,
    });
    setChangingPassword(false);
    if (error) {
      toast.error(error.message ?? 'Không đổi được mật khẩu (kiểm tra mật khẩu hiện tại)');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setPasswordOpen(false);
    toast.success('Đã đổi mật khẩu');
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await createMcpKeyAction(label);
    setCreating(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setLabel('');
    setCopied(false);
    setNewToken(res.data.token);
  }

  async function copyToken() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
    toast.success('Đã sao chép token');
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    const res = await revokeMcpKeyAction(revokeTarget.id);
    setRevoking(false);
    setRevokeTarget(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Đã thu hồi token');
  }

  return (
    <>
      <SettingsTab value="account" surface="bare">
        <SettingsSection title="Hồ sơ">
          <div className="col-span-full flex min-h-14 items-center gap-3 px-4 py-2.5">
            <UserAvatar name={savedName} image={image} className="size-9" />
            <div className="min-w-0 flex-1">
              {editingName ? (
                <form onSubmit={onSaveName} className="flex items-center gap-2">
                  <Input
                    aria-label="Tên hiển thị"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Tên hiển thị"
                    maxLength={60}
                    autoFocus
                    wrapperClassName="min-w-0 flex-1"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!nameDirty || savingName}
                    aria-label="Lưu tên"
                  >
                    {savingName ? <Loader2 className="animate-spin" /> : <Check />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={cancelEditName}
                    disabled={savingName}
                    aria-label="Huỷ"
                  >
                    <X />
                  </Button>
                </form>
              ) : (
                <div className="flex min-w-0 items-center gap-1">
                  <p className="truncate font-bold">{savedName || 'Chưa đặt tên'}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground"
                    onClick={startEditName}
                    aria-label="Sửa tên hiển thị"
                  >
                    <Pencil />
                  </Button>
                </div>
              )}
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <SettingRow icon={CalendarDays} label="Tham gia">
            <span className="tabular-nums">{joinedAt ? formatDateVN(joinedAt) : '—'}</span>
          </SettingRow>
          <SettingRow icon={LogIn} label="Đăng nhập">
            <span className="tabular-nums">
              {lastLoginAt ? formatDateTimeVN(lastLoginAt) : 'Chưa có'}
            </span>
          </SettingRow>
          <SettingRow
            icon={KeyRound}
            label="Mật khẩu"
            info={hasPassword ? undefined : 'Bạn đăng nhập bằng Google nên không có mật khẩu.'}
            className="col-span-full"
          >
            {hasPassword ? (
              <Button
                variant="outline"
                aria-expanded={passwordOpen}
                onClick={() => setPasswordOpen((o) => !o)}
              >
                <Pencil aria-hidden />
                Đổi
              </Button>
            ) : (
              <span className="text-muted-foreground">Google</span>
            )}
          </SettingRow>
          {isAdmin && (
            <SettingRow
              icon={Users}
              label="Quản trị"
              info="Mọi tài khoản đã đăng ký: chặn, bỏ chặn hoặc xoá."
              className="col-span-full"
            >
              <Button asChild variant="outline">
                <Link href="/admin">Mở</Link>
              </Button>
            </SettingRow>
          )}
          {hasPassword && passwordOpen && (
            <form
              onSubmit={onChangePassword}
              className="col-span-full grid gap-3 px-4 pb-4 @md:grid-cols-[1fr_1fr_auto] @md:items-end"
            >
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Hiện tại</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Mới</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={`Ít nhất ${MIN_PASSWORD} ký tự`}
                />
              </div>
              <Button type="submit" disabled={changingPassword || !currentPassword || !newPassword}>
                {changingPassword && <Loader2 className="animate-spin" />}
                Đổi
              </Button>
            </form>
          )}
        </SettingsSection>

        <SettingsSection
          title="Token MCP"
          info="Claude Desktop và ChatGPT dùng token để kết nối dưới tên bạn. Mỗi client một token để thu hồi riêng. Token chỉ hiện một lần khi tạo."
        >
          <form onSubmit={onCreate} className="col-span-full flex items-center gap-2 px-4 py-2.5">
            <Input
              aria-label="Tên token"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Tên token: laptop, máy bàn…"
              maxLength={40}
              wrapperClassName="min-w-0 flex-1"
            />
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
              Thêm
            </Button>
          </form>
          {keys.length === 0 ? (
            <p className="col-span-full px-4 py-3 text-sm text-muted-foreground">Chưa có token.</p>
          ) : (
            keys.map((k) => (
              <div key={k.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                <IconTile icon={KeyRound} tone="muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{k.name}</p>
                  <p className="truncate text-xs text-muted-foreground tabular-nums">
                    Tạo {fmtDate(k.createdAt)} ·{' '}
                    {k.lastUsedAt ? `dùng ${fmtDate(k.lastUsedAt)}` : 'chưa dùng'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label={`Thu hồi token ${k.name}`}
                  onClick={() => setRevokeTarget(k)}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            ))
          )}
        </SettingsSection>

        {mcpUsage && <McpUsageCard usage={mcpUsage} />}
      </SettingsTab>

      <Dialog open={newToken !== null} onOpenChange={(o) => !o && setNewToken(null)}>
        <DialogContent className="h-fit max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Token MCP mới</DialogTitle>
            <DialogDescription>Chép và lưu ngay: token chỉ hiện một lần.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <code className="block max-h-32 overflow-y-auto rounded-md bg-muted px-3 py-2 font-mono text-xs break-all select-all">
              {newToken}
            </code>
            <Button variant="outline" size="sm" onClick={copyToken} className="w-full">
              {copied ? <Check className="text-ok" /> : <Copy />}
              {copied ? 'Đã sao chép' : 'Sao chép token'}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Cấu hình Claude Desktop (Settings → Developer → Edit Config):
            </p>
            <div className="relative">
              <pre className="max-h-56 overflow-auto rounded-lg border border-border/70 bg-muted/40 p-3 text-xs">
                <code>{claudeDesktopConfig(newToken ?? '')}</code>
              </pre>
              <CopyCommandButton
                command={claudeDesktopConfig(newToken ?? '')}
                label="Chép cấu hình"
                size="icon-sm"
                showCopiedText={false}
                toastDescription="none"
                className="absolute top-2 right-2"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Trên Windows, đổi <code>&quot;command&quot;</code> thành <code>&quot;cmd&quot;</code>{' '}
              và thêm <code>&quot;/c&quot;, &quot;npx&quot;</code> vào đầu <code>args</code>. Khởi
              động lại Claude Desktop sau khi lưu.
            </p>
          </div>

          <div className="space-y-2 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              ChatGPT (Settings → Apps → Advanced Settings → Developer mode → Create):
            </p>
            <div className="relative">
              <pre className="max-h-56 overflow-auto rounded-lg border border-border/70 bg-muted/40 p-3 text-xs">
                <code>{`Endpoint: ${mcpEndpoint()}\nAuthorization: Bearer ${newToken ?? ''}`}</code>
              </pre>
              <CopyCommandButton
                command={`Endpoint: ${mcpEndpoint()}\nAuthorization: Bearer ${newToken ?? ''}`}
                label="Chép thông tin kết nối"
                size="icon-sm"
                showCopiedText={false}
                toastDescription="none"
                className="absolute top-2 right-2"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Dùng endpoint trên và cấu hình để ChatGPT gửi HTTP header{' '}
              <code>Authorization: Bearer &lt;token&gt;</code>. ChatGPT chỉ kết nối tới HTTPS công
              khai: với app chạy local, hãy deploy trước hoặc dùng Secure MCP Tunnel. Sau khi tạo,
              chọn app trong một chat mới để thử. Claude và ChatGPT có thể dùng song song.
            </p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button>Tôi đã lưu token</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title="Thu hồi token?"
        description={
          <>
            Token &quot;{revokeTarget?.name}&quot; sẽ ngừng hoạt động ngay. Thiết bị đang dùng nó
            phải tạo token mới để kết nối lại. Không thể hoàn tác.
          </>
        }
        confirmLabel="Thu hồi"
        onConfirm={confirmRevoke}
        pending={revoking}
      />
    </>
  );
}
