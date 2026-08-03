'use client';

import { useState, useTransition } from 'react';
import { Globe, Lock } from 'lucide-react';
import { toastResult } from '@/lib/action-toast';
import { Button } from '@/components/ui/button';
import { publishItemAction, unpublishItemAction } from '@/app/actions';
import { cn } from '@/lib/utils';

/**
 * Item-detail control to share/unshare an item's CONTENT to the public library (Phase 3). Publishing
 * exposes only the content (expression/reading/meaning/notes/enrichment) — never the owner's FSRS
 * schedule or review history. Local state flips optimistically on a successful action.
 *
 * Two shapes: `full` (a labelled button + an explanatory sentence, used inline in a card) and `icon`
 * (a compact icon-only toggle, Lock=private / Globe=shared, with a tooltip) — the detail page moved
 * sharing up onto the breadcrumb row beside the star (2026-07-24), so it uses `icon`.
 */
export function ShareToggle({
  itemId,
  initialPublic,
  variant = 'full',
}: {
  itemId: string;
  initialPublic: boolean;
  variant?: 'full' | 'icon';
}) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [isPending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      const r = isPublic ? await unpublishItemAction(itemId) : await publishItemAction(itemId);
      if (r.ok) setIsPublic((v) => !v);
      toastResult(r, isPublic ? 'Đã thu hồi chia sẻ' : 'Đã chia sẻ vào thư viện');
    });

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-pressed={isPublic}
        aria-label={isPublic ? 'Đang chia sẻ — bấm để thu hồi' : 'Chia sẻ vào thư viện'}
        title={isPublic ? 'Đang chia sẻ vào thư viện — bấm để thu hồi' : 'Chia sẻ vào thư viện'}
        className={cn(
          'inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
          isPublic
            ? 'text-info hover:bg-info/10'
            : 'text-muted-foreground/60 hover:bg-muted hover:text-foreground',
        )}
      >
        {isPublic ? <Globe className="size-4" /> : <Lock className="size-4" />}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Thư viện chung</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={isPublic ? 'secondary' : 'outline'}
          size="sm"
          onClick={toggle}
          disabled={isPending}
        >
          {isPublic ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
          {isPublic ? 'Đang chia sẻ' : 'Chia sẻ vào thư viện'}
        </Button>
        <span className="text-xs text-muted-foreground">
          {isPublic
            ? 'Người khác thấy nội dung mục này và có thể lấy về kho của họ — họ KHÔNG thấy lịch ôn của bạn.'
            : 'Chỉ mình bạn thấy mục này.'}
        </span>
      </div>
    </div>
  );
}
