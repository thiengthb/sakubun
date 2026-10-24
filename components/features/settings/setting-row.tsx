import type { ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { InfoTooltip } from '@/components/common/info-tooltip';
import { cn } from '@/lib/core/utils';

// One setting = one row: a tinted icon, a one- or two-word name, an (i) when the name is not
// self-explanatory, and the control on the right. Explanations live behind the (i), never as a
// paragraph under the row. The rows sit in a @container card, so a wide control (pills, a segmented
// choice) drops under its name when the CARD is narrow, whatever the viewport.
const TONE = {
  brand: 'bg-brand-wash text-accent-brand',
  ok: 'bg-ok-wash text-ok',
  info: 'bg-info-wash text-info',
  warn: 'bg-warn-wash text-warn',
  muted: 'bg-muted text-muted-foreground',
} as const;

export type SettingTone = keyof typeof TONE;

export function SettingIcon({
  icon: Icon,
  glyph,
  tone,
  className,
}: {
  icon?: LucideIcon;
  glyph?: string;
  tone: SettingTone;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg text-sm',
        TONE[tone],
        className,
      )}
    >
      {Icon ? <Icon className="size-4" /> : <span lang="ja">{glyph}</span>}
    </span>
  );
}

export function SettingRow({
  icon,
  glyph,
  tone,
  label,
  unit,
  info,
  aside,
  wide = false,
  children,
  className,
}: {
  icon?: LucideIcon;
  glyph?: string;
  tone: SettingTone;
  label: string;
  unit?: string;
  info?: ReactNode;
  aside?: ReactNode;
  wide?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5', className)}
    >
      <SettingIcon icon={icon} glyph={glyph} tone={tone} />
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate text-sm font-medium">{label}</span>
        {unit && <span className="shrink-0 text-xs text-muted-foreground">{unit}</span>}
        {info && <InfoTooltip label={`Giải thích: ${label}`}>{info}</InfoTooltip>}
        {aside}
      </div>
      <div
        className={cn(
          'flex min-w-0 items-center gap-2',
          wide ? 'w-full @md:ml-auto @md:w-auto' : 'ml-auto',
        )}
      >
        {children}
      </div>
    </div>
  );
}
