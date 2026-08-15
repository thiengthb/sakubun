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
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';
import { createMcpKeyAction, revokeMcpKeyAction } from '@/app/settings/actions';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { SettingsTab } from '@/components/settings/settings-tab';
import { McpUsageCard } from '@/components/settings/mcp-usage-card';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CopyCommandButton } from '@/components/shared/copy-command-button';
import { APP_TIME_ZONE, formatDateTimeVN, formatDateVN } from '@/lib/format';
import type { ToolUsageReport } from '@/lib/mcp/usage';

/**
 * The `claude_desktop_config.json` entry that connects Claude Desktop to THIS deployment, with the
 * freshly created token already in place.
 *
 * The origin is read from the browser rather than hardcoded: the old /guide page hardcoded the
 * production host, which was silently wrong for anyone running the app locally. This dialog only ever
 * renders after a client interaction, so `window` is there; the fallback exists for the SSR pass only.
 */
function claudeConfig(token: string): string {
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

/** One icon + label/value tile in the account timeline; `value` is already-formatted text. */
function MetaTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    // A <dl> may wrap its dt/dd pairs in ONE <div>, and the dt/dd must be that div's DIRECT children
    // (HTML content model). The old markup nested them a second level deep inside a min-w-0 column,
    // which made the pairs invalid and orphaned them from the list — axe's definition-list + dlitem.
    // A two-row grid gives the same icon-beside-text layout without the extra wrapper.
    <div className="grid grid-cols-[auto_1fr] items-start gap-x-3 rounded-lg border bg-muted/30 p-3">
      <Icon className="row-span-2 mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <dt className="min-w-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate font-medium">{value}</dd>
    </div>
  );
}

// better-auth's default minimum password length (emailAndPassword.minPasswordLength).
const MIN_PASSWORD = 8;

/**
 * The "Tài khoản" + "Token MCP" tabs of /settings. Was its own page (/account) while the app was
 * multi-user; folded in here so a single operator has one place for everything. Renders TabsContent
 * only — SettingsForm owns the <Tabs> and <PageShell>.
 */
export function AccountTab({
  name,
  email,
  image,
  hasPassword,
  joinedAt,
  lastLoginAt,
  keys,
  mcpUsage,
}: {
  name: string;
  email: string;
  image: string | null;
  hasPassword: boolean;
  joinedAt: string | null;
  lastLoginAt: string | null;
  keys: McpKeyRow[];
  mcpUsage: ToolUsageReport;
}) {
  const router = useRouter();

  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<McpKeyRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Profile: display name (updateUser) + password (changePassword) — both via better-auth's client.
  const [savedName, setSavedName] = useState(name);
  const [displayName, setDisplayName] = useState(name);
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const trimmedName = displayName.trim();
  const nameDirty = trimmedName.length > 0 && trimmedName !== savedName;

  // Password change keeps the current-password check (the account-takeover guard better-auth enforces);
  // only the redundant "confirm" field was dropped (2026-07-24 request).
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

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
      // Keep other sessions signed in — the operator often uses several devices at once.
      revokeOtherSessions: false,
    });
    setChangingPassword(false);
    if (error) {
      toast.error(error.message ?? 'Không đổi được mật khẩu (kiểm tra mật khẩu hiện tại)');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
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
      {/* ONE tab for the whole account (2026-08-04): identity + password + the MCP tokens that belong to
          that identity. They were two tabs, which made six in a row — and "Token MCP" is not a peer of
          "Nội dung" or "Nhịp học": it is not a preference at all, it is a credential OF this account,
          created and revoked here and nowhere else. Two cards in one tab say that; two tabs said they
          were unrelated pages. */}
      <SettingsTab value="account" surface="bare">
        <Card>
          <CardContent className="space-y-6">
            {/* Identity: avatar + name (with an inline edit button) + email. */}
            <div className="flex items-center gap-4">
              <UserAvatar name={savedName} image={image} className="size-14 text-lg" />
              <div className="min-w-0 flex-1">
                {editingName ? (
                  <form onSubmit={onSaveName} className="flex items-center gap-2">
                    <Input
                      aria-label="Tên hiển thị"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Tên hiển thị của bạn"
                      maxLength={60}
                      autoFocus
                      className="h-8"
                      // sizing goes on the WRAPPER so the clear × stays at the visible right edge
                      wrapperClassName="min-w-0 flex-1"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="size-8 shrink-0"
                      disabled={!nameDirty || savingName}
                      aria-label="Lưu tên"
                    >
                      {savingName ? <Loader2 className="animate-spin" /> : <Check />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={cancelEditName}
                      disabled={savingName}
                      aria-label="Huỷ"
                    >
                      <X />
                    </Button>
                  </form>
                ) : (
                  <div className="flex min-w-0 items-center gap-1">
                    <p className="truncate font-medium">{savedName || 'Chưa đặt tên'}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground"
                      onClick={startEditName}
                      aria-label="Sửa tên hiển thị"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                )}
                <p className="truncate text-sm text-muted-foreground">{email}</p>
              </div>
            </div>

            {/* Read-only account timeline — two tiles, one row on >=sm. */}
            <dl className="grid gap-3 sm:grid-cols-2">
              <MetaTile
                icon={CalendarDays}
                label="Ngày tham gia"
                value={joinedAt ? formatDateVN(joinedAt) : '—'}
              />
              <MetaTile
                icon={LogIn}
                label="Đăng nhập gần nhất"
                value={lastLoginAt ? formatDateTimeVN(lastLoginAt) : 'Chưa có'}
              />
            </dl>

            {/* Password: current + new (the "confirm" field was dropped). Google-only accounts have no
                  password to change, so they see a notice instead. */}
            {hasPassword ? (
              <form onSubmit={onChangePassword} className="space-y-3 border-t pt-6">
                <p className="font-medium">Đổi mật khẩu</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
                    <Input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Mật khẩu mới</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={`Tối thiểu ${MIN_PASSWORD} ký tự`}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={changingPassword || !currentPassword || !newPassword}
                >
                  {changingPassword && <Loader2 className="animate-spin" />}
                  Đổi mật khẩu
                </Button>
              </form>
            ) : (
              <div className="flex items-center rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Bạn đăng nhập bằng Google nên tài khoản không có mật khẩu để đổi.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          {/* A header, because this card no longer has a tab label naming it. */}
          <CardHeader>
            <CardTitle>Token MCP</CardTitle>
            <CardDescription>
              Claude Desktop dùng token này để kết nối tới sakubun DƯỚI DANH NGHĨA bạn. Token chỉ
              hiện MỘT lần khi tạo — lưu lại ngay. Thu hồi bất cứ lúc nào (có hiệu lực tức thì).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={onCreate} className="flex items-end gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="token-name">Tên token</Label>
                <Input
                  id="token-name"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="laptop, máy bàn…"
                  maxLength={40}
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="animate-spin" />}
                Tạo token
              </Button>
            </form>

            {keys.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có token nào.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {keys.map((k) => (
                  <li
                    key={k.id}
                    className="flex items-start justify-between gap-2 rounded-lg border p-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-2 font-medium">
                        <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{k.name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Tạo {fmtDate(k.createdAt)}</p>
                      <p className="text-xs text-muted-foreground">
                        {k.lastUsedAt ? `Dùng gần nhất ${fmtDate(k.lastUsedAt)}` : 'Chưa dùng'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="-mt-1 -mr-1 shrink-0"
                      aria-label={`Thu hồi token ${k.name}`}
                      onClick={() => setRevokeTarget(k)}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* What Claude did with that token. Read-only, so it lives outside every form on this tab. */}
        <McpUsageCard usage={mcpUsage} />
      </SettingsTab>

      {/* Token shown once, right after creation. Kept outside TabsContent so it survives a tab switch. */}
      <Dialog open={newToken !== null} onOpenChange={(o) => !o && setNewToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Token MCP mới</DialogTitle>
            <DialogDescription>
              Sao chép và lưu ngay — token này SẼ KHÔNG hiện lại. Dán vào{' '}
              <code>claude_desktop_config.json</code> của Claude Desktop theo mẫu bên dưới.
            </DialogDescription>
          </DialogHeader>
          {/* Wrap the token (break-all) inside a bounded block — DialogContent is a grid, so a long
                unbroken string in a flex row would push the dialog past its max-width and break the UI. */}
          <div className="space-y-2">
            <code className="block max-h-32 overflow-y-auto rounded-md bg-muted px-3 py-2 font-mono text-xs break-all select-all">
              {newToken}
            </code>
            <Button variant="outline" size="sm" onClick={copyToken} className="w-full">
              {copied ? <Check className="text-ok" /> : <Copy />}
              {copied ? 'Đã sao chép' : 'Sao chép token'}
            </Button>
          </div>

          {/* The connect recipe. It used to live on /guide, which is gone — and this dialog is the one
              moment the learner actually needs it, because the token is only readable HERE and only
              once. The token is substituted into the block, so there is nothing left to hand-edit. */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Cấu hình Claude Desktop (Settings → Developer → Edit Config):
            </p>
            <div className="relative">
              <pre className="max-h-56 overflow-auto rounded-lg border border-border/70 bg-muted/40 p-3 text-xs">
                <code>{claudeConfig(newToken ?? '')}</code>
              </pre>
              <CopyCommandButton
                command={claudeConfig(newToken ?? '')}
                label="Chép cấu hình"
                size="icon-sm"
                showCopiedText={false}
                toastDescription="none"
                className="absolute top-2 right-2"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Trên Windows, đổi <code>&quot;command&quot;</code> thành <code>&quot;cmd&quot;</code> và
              thêm <code>&quot;/c&quot;, &quot;npx&quot;</code> vào đầu <code>args</code>. Khởi động
              lại Claude Desktop sau khi lưu.
            </p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button>Tôi đã lưu token</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation. */}
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
