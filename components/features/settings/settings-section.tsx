import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { InfoTooltip } from '@/components/common/info-tooltip';
import { cn } from '@/lib/core/utils';

// One card of setting rows under a short heading: the shape every Settings tab shares. The heading
// is a word or two; anything longer sits behind its (i). Rows run in two columns once the card is
// wide (a gap-px grid draws the rules); a child with `col-span-full` spans both.
export function SettingsSection({
  title,
  info,
  children,
  className,
}: {
  title?: string;
  info?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-2', className)}>
      {title && (
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-bold">{title}</h2>
          {info && <InfoTooltip label={`Giải thích: ${title}`}>{info}</InfoTooltip>}
        </div>
      )}
      <Card className="@container gap-0 overflow-hidden py-0">
        <div className="grid gap-px bg-border @4xl:grid-cols-2 [&>*]:bg-card">{children}</div>
      </Card>
    </section>
  );
}
