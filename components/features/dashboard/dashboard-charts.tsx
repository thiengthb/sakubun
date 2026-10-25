import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { IconTile, type IconTone } from '@/components/common/icon-tile';
import { InfoTooltip } from '@/components/common/info-tooltip';
import { ScrollEndOnMount } from '@/components/common/scroll-end-on-mount';
import { chartEmptyMessage } from '@/lib/insights/chart-empty';
import { cn } from '@/lib/core/utils';

// The dashboard's chart vocabulary: stat tiles, a chart frame, bar rows, the activity heatmap and
// the state legend. Every frame names itself with an icon and one or two words; what a number
// counts and where it comes from sits behind the (i), never as a caption under it.

export function StatTile({
  icon,
  media,
  tone = 'brand',
  items,
  compact,
  explain,
  note,
  className,
}: {
  icon?: LucideIcon;
  media?: ReactNode;
  tone?: IconTone;
  items: { value: ReactNode; label: string }[];
  /** One value for a phone-width tile when `items` holds two that would not fit side by side. */
  compact?: { value: ReactNode; label: string };
  explain?: ReactNode;
  /** One short line of context under the number (a record, a remainder); wraps to two lines. */
  note?: ReactNode;
  className?: string;
}) {
  const metric = (item: { value: ReactNode; label: string }, className?: string) => (
    <div key={item.label} className={cn('min-w-0', className)}>
      <div className="truncate text-title2 leading-tight font-semibold tabular-nums">
        {item.value}
      </div>
      <div className="truncate text-xs text-muted-foreground">{item.label}</div>
    </div>
  );
  return (
    <Card className={cn('relative flex-row items-start gap-3 p-4', className)}>
      {/* A phone tile is half the width: the number gets the room, the icon goes. */}
      <div className="max-sm:hidden">{media ?? <IconTile icon={icon} tone={tone} />}</div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className={cn('flex min-w-0 gap-4', compact && 'max-sm:hidden')}>
          {items.map((item) => metric(item))}
        </div>
        {compact && metric(compact, 'sm:hidden')}
        {note && <p className="line-clamp-2 text-xs text-muted-foreground">{note}</p>}
      </div>
      {explain && (
        <InfoTooltip label={`Giải thích: ${items.map((i) => i.label).join(', ')}`}>
          {explain}
        </InfoTooltip>
      )}
    </Card>
  );
}

export function ChartCard({
  icon: Icon,
  title,
  info,
  action,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  info?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('h-full gap-3 p-4', className)}>
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <h3 className="truncate text-sm font-medium">{title}</h3>
        {info && <InfoTooltip label={`Giải thích: ${title}`}>{info}</InfoTooltip>}
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
      {children}
    </Card>
  );
}

export function Bars({
  data,
  barClass = 'bg-accent-brand/70',
  empty,
}: {
  data: { label: string; short?: string; value: number; hint?: string }[];
  barClass?: string;
  empty: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.every((d) => d.value === 0)) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="flex items-end gap-1.5">
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-caption2 text-muted-foreground tabular-nums">{d.value || ''}</span>
          <div className="flex h-24 w-full items-end">
            <div
              className={cn('w-full rounded-t', barClass)}
              style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }}
              title={d.hint ?? `${d.label}: ${d.value}`}
              aria-hidden
            />
          </div>
          <span className="max-w-full truncate text-caption2 text-muted-foreground tabular-nums">
            {d.short ?? d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function HeatmapLegend() {
  return (
    <div className="flex items-center gap-1 text-caption2 text-muted-foreground">
      ít
      <span className="size-3 rounded-xs bg-muted" />
      <span className="size-3 rounded-xs bg-accent-brand/40" />
      <span className="size-3 rounded-xs bg-accent-brand/70" />
      <span className="size-3 rounded-xs bg-accent-brand" />
      nhiều
    </div>
  );
}

export function Heatmap({ data, max }: { data: { day: string; count: number }[]; max: number }) {
  const empty = chartEmptyMessage({
    hasInWindow: data.some((d) => d.count > 0),
    hasInYear: data.some((d) => d.count > 0),
    rangeLabel: '1 năm',
    noun: 'hoạt động nào',
  });
  if (empty) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ScrollEndOnMount>
      <div className="grid grid-flow-col grid-rows-7 gap-1">
        {data.map((d) => {
          const ratio = d.count / max;
          return (
            <div
              key={d.day}
              className={cn('size-3 rounded-xs', d.count === 0 ? 'bg-muted' : 'bg-accent-brand')}
              style={d.count === 0 ? undefined : { opacity: 0.3 + 0.7 * ratio }}
              title={`${d.day}: ${d.count} lượt`}
              aria-hidden
            />
          );
        })}
      </div>
    </ScrollEndOnMount>
  );
}

const STATE_SEGMENTS = [
  { key: 'new', label: 'Mới', bar: 'bg-muted-foreground/30' },
  { key: 'learning', label: 'Đang học', bar: 'bg-warn/70' },
  { key: 'review', label: 'Ôn tập', bar: 'bg-ok/70' },
  { key: 'relearning', label: 'Học lại', bar: 'bg-alert/70' },
  { key: 'suspended', label: 'Tạm ngưng', bar: 'bg-muted-foreground/50' },
] as const;

// The legend doubles as the whole-library count per state, which used to be a card of its own.
function StateLegend({ totals }: { totals: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {STATE_SEGMENTS.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-full', s.bar)} aria-hidden />
          {s.label}
          <span className="font-medium text-foreground tabular-nums">{totals[s.key] ?? 0}</span>
        </span>
      ))}
    </div>
  );
}

export function LevelBars({
  data,
  totals,
}: {
  data: {
    level: string;
    new: number;
    learning: number;
    review: number;
    relearning: number;
    suspended: number;
    total: number;
  }[];
  totals: Record<string, number>;
}) {
  if (data.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Kho chưa có mẫu nào.</p>;
  }
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.level} className="flex items-center gap-3">
          <span className="w-8 shrink-0 text-xs font-medium tabular-nums">{d.level}</span>
          <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            {STATE_SEGMENTS.map((s) => {
              const v = d[s.key];
              if (v === 0) return null;
              return (
                <div
                  key={s.key}
                  className={s.bar}
                  style={{ width: `${(v / d.total) * 100}%` }}
                  title={`${d.level} · ${s.label}: ${v}`}
                />
              );
            })}
          </div>
          <span className="w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
            {d.total}
          </span>
        </div>
      ))}
      <StateLegend totals={totals} />
    </div>
  );
}
