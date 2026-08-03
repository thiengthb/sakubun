'use client';

import { useOptimistic, useTransition } from 'react';
import { Share2 } from 'lucide-react';
import { toastResult } from '@/lib/action-toast';
import { Label } from '@/components/ui/label';
import { Explain } from '@/components/shared/explain';
import { Switch } from '@/components/ui/switch';
import { saveSettingsAction } from '@/app/actions';
import { cn } from '@/lib/utils';

/**
 * /history community-tab toggle: when on, every sentence the learner grades from now on is auto-shared
 * to the feed (persisted to settings via `saveSettingsAction`; honored in `submitReview`). Optimistic so
 * the switch flips instantly; the server settles it. Off by default — sharing stays opt-in. Compact
 * (short visible label + full aria-label) because it lives on the header row beside the tabs.
 */
export function AutoShareToggle({ enabled, className }: { enabled: boolean; className?: string }) {
  const [optimistic, setOptimistic] = useOptimistic(enabled);
  const [, startTransition] = useTransition();

  const toggle = (next: boolean) =>
    startTransition(async () => {
      setOptimistic(next);
      const r = await saveSettingsAction({ autoShareSentences: next });
      toastResult(r, next ? 'Sẽ tự chia sẻ câu mới lên cộng đồng' : 'Đã tắt tự chia sẻ câu mới');
    });

  return (
    <Explain text="Bật thì mỗi câu vừa được chấm sẽ tự lên feed cộng đồng. Câu cũ không bị ảnh hưởng, và bạn vẫn gỡ chia sẻ từng câu được.">
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5 ring-1 ring-foreground/10',
          className,
        )}
      >
        <Share2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Label htmlFor="auto-share" className="cursor-pointer text-sm whitespace-nowrap">
          Tự chia sẻ câu mới
        </Label>
        <Switch
          id="auto-share"
          checked={optimistic}
          onCheckedChange={toggle}
          aria-label="Tự động chia sẻ câu mới lên cộng đồng"
        />
      </div>
    </Explain>
  );
}
