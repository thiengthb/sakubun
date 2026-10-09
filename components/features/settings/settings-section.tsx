import type { ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { SectionHeading } from '@/components/common/section-heading';

// A band of related settings groups. Merging Nội dung + Nhịp học + Nghe & nói into one tab put six
// groups on one page, which is too flat to scan — the reader cannot tell where one concern ends.
// A band is the outer tier: SectionHeading level="page" over its groups, exactly the two-tier shape
// the dashboard already uses, so the two long pages of the app read the same way.
export function SettingsSection({
  icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <SectionHeading icon={icon} title={title} hint={hint} level="page" />
      <div className="space-y-6">{children}</div>
    </section>
  );
}
