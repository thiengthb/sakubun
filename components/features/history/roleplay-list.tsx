'use client';

import { useState } from 'react';
import { Drama } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/empty-state';
import { LIST_CARD } from '@/components/common/list-card';
import { RelativeTime } from '@/components/common/relative-time';
import { roleplayCommand } from '@/lib/kaiwa/commands';
import { TONE } from '@/components/features/history/history-shared';
import { Button, ButtonLink } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Truncate } from '@/components/ui/truncate';
import type { RoleplayRow } from '@/lib/kaiwa/roleplays';
import { cn } from '@/lib/core/utils';

async function copyCommand(command: string) {
  try {
    await navigator.clipboard.writeText(command);
    toast.success('Đã chép, dán vào Claude', { description: command });
  } catch {
    toast.error('Không chép được vào clipboard', { description: command });
  }
}

const score = (r: RoleplayRow) => `${r.correct}/${r.total} câu đúng ý`;

// Lịch sử › Nhập vai (Kaiwa d2, docs/plans/2026-11-07-kaiwa-voices-roleplay.md): one card per
// role-play saved by kaiwa_roleplay_save, newest first. A card opens the session turn by turn: the
// model line, what the learner said and the AI's note, the turns not yet right in the warn tone.
export function RoleplayList({ roleplays }: { roleplays: RoleplayRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = roleplays.find((r) => r.id === openId) ?? null;

  if (roleplays.length === 0)
    return (
      <EmptyState
        icon={Drama}
        title="Chưa có buổi nhập vai nào"
        description="Mở một kịch bản ở Hội thoại, chọn Thao tác › Nhập vai với AI rồi dán vào Claude. Hết bài, Claude lưu buổi đó vào đây."
      />
    );

  return (
    <div className="@container">
      <ul className="grid gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3">
        {roleplays.map((r) => (
          <li key={r.id} data-slot="roleplay-card" className="flex">
            {/* The whole card opens the session; it holds no other control. */}
            <button
              type="button"
              aria-label={`Xem buổi nhập vai ${r.scriptTitle}`}
              onClick={() => setOpenId(r.id)}
              className={cn(
                LIST_CARD.base,
                'flex w-full min-w-0 flex-col gap-1 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              )}
            >
              <Truncate className="font-medium">{r.scriptTitle}</Truncate>
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <span className="shrink-0 text-muted-foreground">Vai {r.part}</span>
                <span aria-hidden className="text-muted-foreground">
                  ·
                </span>
                <span className={r.correct === r.total ? TONE.ok.text : TONE.warn.text}>
                  {score(r)}
                </span>
              </span>
              <span className="mt-auto pt-1 text-xs text-muted-foreground">
                <RelativeTime value={r.createdAt} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="sm:max-w-lg">
          {open && <RoleplayDetail roleplay={open} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleplayDetail({ roleplay: r }: { roleplay: RoleplayRow }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{r.scriptTitle}</DialogTitle>
        <DialogDescription>
          Vai {r.part} · {score(r)} · <RelativeTime value={r.createdAt} />
        </DialogDescription>
      </DialogHeader>
      <ol className="-mx-1 max-h-[min(60svh,var(--container-lg))] space-y-2 overflow-y-auto px-1">
        {r.turns.map((t) => (
          <li
            key={t.turn}
            data-slot="roleplay-turn"
            data-ok={t.ok}
            className={cn('space-y-1 rounded-lg p-3', t.ok ? 'bg-muted' : TONE.warn.pill)}
          >
            <p className="text-xs font-medium">
              Lượt {t.turn} · {t.ok ? 'Đúng ý' : 'Chưa đúng'}
            </p>
            {t.model && (
              <p className="text-sm text-muted-foreground">
                Câu mẫu: <span lang="ja">{t.model.japanese}</span>
                {t.model.translation && ` (${t.model.translation})`}
              </p>
            )}
            <p className="text-sm text-foreground">
              Bạn nói: <span lang="ja">{t.said}</span>
            </p>
            {t.note && <p className="text-sm text-foreground">{t.note}</p>}
          </li>
        ))}
      </ol>
      <DialogFooter>
        {r.scriptExists && (
          <ButtonLink href={`/kaiwa/${r.scriptId}`} variant="outline">
            Mở kịch bản
          </ButtonLink>
        )}
        <Button onClick={() => copyCommand(roleplayCommand(r.scriptTitle, r.part))}>
          Nhập vai lại
        </Button>
      </DialogFooter>
    </>
  );
}
