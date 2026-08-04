import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/**
 * The ONE shell every /settings tab renders inside.
 *
 * It exists because the five tabs had drifted into five different layouts: four wrote `pt-2` and one
 * wrote nothing, so the gap under the header row changed as you switched tabs; the vertical rhythm was
 * `space-y-6` on three tabs and `space-y-8` on another; and three tabs put their fields BARE on the page
 * background while the other two put theirs on cards — so switching tabs changed the surface the content
 * sat on, not just the content. Reported 2026-08-05: *"mỗi tab lại một layout có padding hay margin khác
 * nhau"*.
 *
 * The fix is structural, not a sweep of matching numbers: with the shell here, a tab CANNOT choose its
 * own padding, so the five cannot drift apart again. Vertical spacing between tab sections is
 * `space-y-6` for everyone; the outer page rhythm stays PageShell's (`space-y-4 pt-6`), which is why
 * this adds no top padding of its own — the header row's gap belongs to PageShell, and a tab adding
 * `pt-2` on top of it was the drift.
 *
 * `surface="card"` (the default) wraps the body in the app's Card, which is what the rest of the app
 * puts content on. `surface="bare"` is for a tab that renders its OWN cards (Dữ liệu, Tài khoản) — it
 * would otherwise nest a card in a card. That is the only difference between the two, and it is about
 * who owns the surface, never about spacing.
 */
export function SettingsTab({
  value,
  children,
  surface = 'card',
  className,
}: {
  value: string;
  children: ReactNode;
  surface?: 'card' | 'bare';
  className?: string;
}) {
  return (
    <TabsContent value={value} className={cn('space-y-6', className)}>
      {surface === 'card' ? (
        <Card>
          <CardContent className="space-y-6">{children}</CardContent>
        </Card>
      ) : (
        children
      )}
    </TabsContent>
  );
}
