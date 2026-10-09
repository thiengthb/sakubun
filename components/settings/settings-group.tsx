import type { ReactNode } from 'react';
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
