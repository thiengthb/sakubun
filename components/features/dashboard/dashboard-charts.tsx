import { type LucideIcon } from 'lucide-react';
import { ScrollEndOnMount } from '@/components/common/scroll-end-on-mount';
import { chartEmptyMessage } from '@/lib/insights/chart-empty';
import { cn } from '@/lib/core/utils';

// The dashboard's own chart vocabulary: stat tiles, a chart frame, bar rows, the activity heatmap
// and the two legends. It lived inside app/page.tsx, which made it invisible to anything else and
// made the route file 548 lines of mostly presentation.

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  hero = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  hero?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/70 bg-card p-4',
        hero && 'border-accent-brand/30',
      )}
    >
      {hero && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent-brand/10 to-transparent"
        />
      )}
      <div className="relative">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="size-4" aria-hidden />
          {label}
        </div>
        <div
          className={cn(
            'mt-2 font-semibold',
            hero ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl',
          )}
        >
          {value}
        </div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

export function ChartCard({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('h-full space-y-4 rounded-xl border border-border/70 bg-card p-4', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h3 className="text-body font-medium text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </div>
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
    return <p className="py-8 text-center text-subhead text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="flex items-end gap-1.5">
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <span className="text-[10px] text-muted-foreground">{d.value || ''}</span>
          <div className="flex h-24 w-full items-end">
            <div
              className={cn('w-full rounded-t', barClass)}
              style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }}
              title={d.hint ?? `${d.label}: ${d.value}`}
              aria-hidden
            />
          </div>
          <span className="max-w-full truncate text-[10px] text-muted-foreground">
            {d.short ? (
              <>
                <span className="md:hidden">{d.short}</span>
                <span className="max-md:hidden">{d.label}</span>
              </>
            ) : (
              d.label
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export function WeakList({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function HeatmapLegend() {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      ít
      <span className="size-3 rounded-[3px] bg-muted" />
      <span className="size-3 rounded-[3px] bg-accent-brand/40" />
      <span className="size-3 rounded-[3px] bg-accent-brand/70" />
      <span className="size-3 rounded-[3px] bg-accent-brand" />
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
    return <p className="py-8 text-center text-subhead text-muted-foreground">{empty}</p>;
  }
  return (
    <ScrollEndOnMount>
      <div className="grid grid-flow-col grid-rows-7 gap-1">
        {data.map((d) => {
          const ratio = d.count / max;
          return (
            <div
              key={d.day}
              className={cn('size-3 rounded-[3px]', d.count === 0 ? 'bg-muted' : 'bg-accent-brand')}
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

export function StateLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {STATE_SEGMENTS.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className={cn('size-2.5 rounded-full', s.bar)} aria-hidden />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function MasteryBar({ mastery }: { mastery: Record<string, number> }) {
  const total = STATE_SEGMENTS.reduce((sum, s) => sum + (mastery[s.key] ?? 0), 0);
  if (total === 0) {
    return (
      <p className="py-4 text-center text-subhead text-muted-foreground">Kho chưa có mẫu nào.</p>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {STATE_SEGMENTS.map((s) => {
          const v = mastery[s.key] ?? 0;
          if (v === 0) return null;
          return (
            <div
              key={s.key}
              className={s.bar}
              style={{ width: `${(v / total) * 100}%` }}
              title={`${s.label}: ${v}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {STATE_SEGMENTS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-full', s.bar)} aria-hidden />
            {s.label}
            <span className="font-medium text-foreground">{mastery[s.key] ?? 0}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function LevelBars({
  data,
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
}) {
  if (data.length === 0) {
    return (
      <p className="py-4 text-center text-subhead text-muted-foreground">Kho chưa có mẫu nào.</p>
    );
  }
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.level} className="flex items-center gap-3">
          <span className="w-8 shrink-0 text-xs font-medium tabular-nums">{d.level}</span>
          <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-muted">
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
      <StateLegend />
    </div>
  );
}
