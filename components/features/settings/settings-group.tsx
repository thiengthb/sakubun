import type { ReactNode } from 'react';
import { SectionHeading } from '@/components/common/section-heading';
import { Card, CardContent } from '@/components/ui/card';

export function SettingsGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <SectionHeading title={title} hint={hint} />
      <Card>
        <CardContent className="space-y-6">{children}</CardContent>
      </Card>
    </section>
  );
}
