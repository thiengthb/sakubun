'use client';

import { useState, useTransition } from 'react';
import { Plug, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { IconTile } from '@/components/common/icon-tile';
import { SettingsSection } from '@/components/features/settings/settings-section';
import { revokeConnectedAppAction } from '@/app/settings/actions';
import { toastResult } from '@/lib/core/action-toast';
import { formatDateVN } from '@/lib/core/format';

export type ConnectedAppRow = {
  clientId: string;
  name: string;
  uri: string | null;
  connectedAt: string;
  lastUsedAt: string | null;
};

function host(uri: string | null): string | null {
  if (!uri) return null;
  try {
    return new URL(uri).host;
  } catch {
    return null;
  }
}

/**
 * The apps the learner let in by signing in on their site (claude.ai, ChatGPT), as opposed to the MCP
 * tokens they paste by hand (roadmap 4.2). Revoking cuts the app off on its next call.
 */
export function ConnectedAppsSection({ apps }: { apps: ConnectedAppRow[] }) {
  const [target, setTarget] = useState<ConnectedAppRow | null>(null);
  const [pending, startTransition] = useTransition();

  const confirmRevoke = () => {
    const app = target;
    if (!app) return;
    startTransition(async () => {
      const r = await revokeConnectedAppAction(app.clientId);
      if (toastResult(r, `Đã thu hồi quyền của ${app.name}`)) setTarget(null);
    });
  };

  return (
    <>
      <SettingsSection
        title="Ứng dụng đã kết nối"
        info="Ứng dụng bạn cho phép bằng cách đăng nhập trên trang của chúng, như claude.ai hay ChatGPT. Thu hồi thì ứng dụng mất quyền ngay; muốn dùng lại thì kết nối lại từ ứng dụng đó."
      >
        {apps.length === 0 ? (
          <p className="col-span-full px-4 py-3 text-sm text-muted-foreground">
            Chưa có ứng dụng nào.
          </p>
        ) : (
          apps.map((app) => {
            const site = host(app.uri);
            return (
              <div key={app.clientId} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                <IconTile icon={Plug} tone="muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {app.name}
                    {site && <span className="font-normal text-muted-foreground"> · {site}</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground tabular-nums">
                    Kết nối {formatDateVN(app.connectedAt)} ·{' '}
                    {app.lastUsedAt ? `dùng ${formatDateVN(app.lastUsedAt)}` : 'chưa dùng'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  aria-label={`Thu hồi quyền của ${app.name}`}
                  onClick={() => setTarget(app)}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
            );
          })
        )}
      </SettingsSection>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title="Thu hồi quyền?"
        description={`${target?.name} không gọi sakubun được nữa từ lần kế tiếp. Dữ liệu học của bạn không đổi.`}
        confirmLabel="Thu hồi"
        onConfirm={confirmRevoke}
        pending={pending}
      />
    </>
  );
}
