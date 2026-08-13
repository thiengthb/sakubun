import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * A titled group of settings inside a `surface="bare"` tab (issue #38).
 *
 * Two tabs were single flat cards of loose fields — "Nội dung" carried eight, "Nhịp học" seven — with no
 * signal about which ones belong together. That is what let four knobs that all describe ONE SENTENCE
 * (`Cỡ câu`, `Độ phức tạp`, `Từ vựng / câu`, `Mẫu mới tối đa / câu`) end up split across two tabs, and
 * why the info text on `Độ phức tạp` has to cross-reference the other three by name so the reader does
 * not confuse them. Cross-references that exist to compensate for placement are a placement bug.
 *
 * The heading shape is lifted VERBATIM from `settings-data-tab.tsx` (`font-heading text-sm font-semibold`
 * + an xs hint), which had already solved this for its own two groups. Sharing the component is the
 * point: three tabs cannot drift into three heading styles the way the five tabs drifted into five
 * layouts before `SettingsTab` existed.
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
