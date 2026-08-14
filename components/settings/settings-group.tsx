import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * A titled group of settings inside a `surface="bare"` tab (issue #38).
 *
 * Two tabs were flat cards of loose fields — eight in "Nội dung", seven in "Nhịp học" — with no signal
 * about which belong together. That is what let four knobs describing ONE SENTENCE end up split across
 * two tabs, and why the info text on `Độ phức tạp` has to name the other three so the reader does not
 * confuse them. A cross-reference that exists to compensate for placement is a placement bug.
 *
 * The heading shape is lifted VERBATIM from `settings-data-tab.tsx`, which had already solved this for
 * its own two groups. Sharing one component is the point: three tabs cannot drift into three heading
 * styles the way five tabs drifted into five layouts before `SettingsTab` existed.
 */
export function SettingsGroup({
  title,
  hint,
  children,
}: {
  title: string;
  /** One line on what the group decides. Optional, but a group without one is usually a group of one. */
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="font-heading text-sm font-semibold">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Card>
        <CardContent className="space-y-6">{children}</CardContent>
      </Card>
    </section>
  );
}
