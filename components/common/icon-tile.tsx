import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/core/utils';

// The tinted square an icon sits in, wherever a row or tile leads with one (settings rows, the
// dashboard stat tiles). One size, size-8 with a size-4 icon: the tile carries the colour, the
// icon never grows to make a point.
const TONE = {
  // Raised like a primary button: the settings rows lead with it.
  primary: 'bg-primary text-primary-foreground shadow-lift-primary',
  brand: 'bg-brand-wash text-accent-brand',
  ok: 'bg-ok-wash text-ok',
  info: 'bg-info-wash text-info',
  warn: 'bg-warn-wash text-warn',
  muted: 'bg-muted text-muted-foreground',
} as const;

export type IconTone = keyof typeof TONE;

export function IconTile({
  icon: Icon,
  glyph,
  tone,
  className,
}: {
  icon?: LucideIcon;
  glyph?: string;
  tone: IconTone;
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
