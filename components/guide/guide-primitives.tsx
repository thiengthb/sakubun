import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Illustration primitives for the /guide walkthroughs — the little "screen" mockups (window frames,
// chat bubbles, chips, fields, click targets). Pure presentational (no hooks); the stagger animation
// is CSS-only (globals.css guide-*), driven by the `--i` index var set via `iv()`.

export const iv = (i: number) => ({ ['--i']: i }) as CSSProperties;

/** A macOS-ish window/terminal/chat frame so illustrations read as "a screen". */
export function Window({
  title,
  icon: Icon,
  children,
}: {
  title?: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="w-full overflow-hidden rounded-lg border bg-background shadow-sm">
      <div className="flex items-center gap-1.5 border-b bg-muted/50 px-3 py-1.5">
        <span className="size-2 rounded-full bg-alert/70" />
        <span className="size-2 rounded-full bg-warn/70" />
        <span className="size-2 rounded-full bg-ok/70" />
        {title && (
          <span className="ml-2 flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
            {Icon && <Icon className="size-3 shrink-0" />}
            {title}
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-3">{children}</div>
    </div>
  );
}

export function Bubble({
  from,
  i = 0,
  children,
}: {
  from: 'user' | 'claude';
  i?: number;
  children: ReactNode;
}) {
  const isUser = from === 'user';
  return (
    <div className={cn('guide-pop flex', isUser ? 'justify-end' : 'justify-start')} style={iv(i)}>
      <span
        className={cn(
          'max-w-[88%] rounded-2xl px-3 py-1.5 text-xs leading-5',
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm bg-muted text-foreground',
        )}
      >
        {children}
      </span>
    </div>
  );
}

export const CHIP_TONES = {
  muted: 'bg-muted text-foreground border-border',
  primary: 'bg-primary/10 text-primary border-primary/30',
  ok: 'bg-ok/10 text-ok border-ok/30',
  info: 'bg-info/10 text-info border-info/30',
  alert: 'bg-alert/10 text-alert border-alert/30',
  warn: 'bg-warn/10 text-warn border-warn/30',
} as const;

export function Chip({
  children,
  tone = 'muted',
  i = 0,
}: {
  children: ReactNode;
  tone?: keyof typeof CHIP_TONES;
  i?: number;
}) {
  return (
    <span
      className={cn(
        'guide-pop inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        CHIP_TONES[tone],
      )}
      style={iv(i)}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
  i = 0,
}: {
  label: string;
  children: ReactNode;
  i?: number;
}) {
  return (
    <div
      className="guide-pop flex items-center justify-between gap-3 rounded-md border bg-background px-2.5 py-1.5 text-[11px]"
      style={iv(i)}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

/** A pulsing ring marking a click target — position it with absolute classes from the parent. */
export function ClickDot({ className }: { className?: string }) {
  return (
    <span className={cn('pointer-events-none absolute z-10', className)} aria-hidden>
      <span className="relative flex size-5 items-center justify-center">
        <span className="guide-clickring absolute inset-0 rounded-full border-2 border-primary" />
        <span className="size-2.5 rounded-full bg-primary shadow" />
      </span>
    </span>
  );
}

export function Ja({ children }: { children: ReactNode }) {
  return (
    <span lang="ja" className="font-medium">
      {children}
    </span>
  );
}
