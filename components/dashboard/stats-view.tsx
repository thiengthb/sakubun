'use client';

import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSessionState } from '@/components/shared/use-session-state';
import { chartEmptyMessage } from '@/lib/chart-empty';
import { cn } from '@/lib/utils';
import type { DailyStat, StudyStats } from '@/lib/stats';
import type { PerfBreakdown } from '@/lib/analytics';

const C = {
  accuracy: 'var(--color-ok)',
  time: 'var(--color-accent-brand)',
  count: 'var(--color-muted-foreground)',
  neu: 'var(--color-info)',
  grid: 'var(--color-border)',
  axis: 'var(--color-muted-foreground)',
};

const RANGES = [
  { value: '30', label: '30 ngày' },
  { value: '90', label: '90 ngày' },
  { value: '365', label: '1 năm' },
] as const;

const GROUPS = [
  { value: 'day', label: 'Theo ngày' },
  { value: 'week', label: 'Theo tuần' },
  { value: 'month', label: 'Theo tháng' },
  { value: 'weekday', label: 'Thứ trong tuần' },
] as const;
type GroupBy = (typeof GROUPS)[number]['value'];

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

interface Bucket {
  label: string;
  order: number;
  reviews: number;
  correct: number;
  secSum: number;
  secCount: number;
  sentences: number;
  newItems: number;
}

function bucketize(daily: DailyStat[], groupBy: GroupBy): Bucket[] {
  const map = new Map<string, Bucket>();
  const add = (key: string, label: string, order: number, d: DailyStat) => {
    const b =
      map.get(key) ??
      (() => {
        const fresh: Bucket = {
          label,
          order,
          reviews: 0,
          correct: 0,
          secSum: 0,
          secCount: 0,
          sentences: 0,
          newItems: 0,
        };
        map.set(key, fresh);
        return fresh;
      })();
    b.reviews += d.reviews;
    b.correct += d.correct;
    b.secSum += d.secSum;
    b.secCount += d.secCount;
    b.sentences += d.sentences;
    b.newItems += d.newItems;
  };

  daily.forEach((d, i) => {
    const date = new Date(`${d.day}T00:00:00`);
    if (groupBy === 'day') {
      add(d.day, `${date.getMonth() + 1}/${date.getDate()}`, i, d);
    } else if (groupBy === 'weekday') {
      const wd = (date.getDay() + 6) % 7; // Monday-first 0..6
      add(String(wd), WEEKDAY_LABELS[wd], wd, d);
    } else if (groupBy === 'month') {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      add(key, `${date.getMonth() + 1}/${String(date.getFullYear()).slice(2)}`, i, d);
    } else {
      const wd = (date.getDay() + 6) % 7;
      const monday = new Date(date.getTime() - wd * 86_400_000);
      const key = monday.toISOString().slice(0, 10);
      add(key, `${monday.getMonth() + 1}/${monday.getDate()}`, monday.getTime(), d);
    }
  });

  return [...map.values()].sort((a, b) => a.order - b.order);
}

const tooltipStyle = {
  background: 'var(--color-popover)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  color: 'var(--color-popover-foreground)',
  fontSize: 12,
};
const axisTick = { fill: C.axis, fontSize: 11 };

function ChartCard({
  title,
  hint,
  children,
  className,
  empty,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  empty?: string | false | null;
}) {
  return (
    <div className={cn('space-y-3 rounded-lg border border-border/70 p-4', className)}>
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {empty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        children
      )}
    </div>
  );
}

export function StatsView({ stats }: { stats: StudyStats }) {
  const [range, setRange] = useSessionState<'30' | '90' | '365'>('stats.range', '90', 'srange');
  const [groupBy, setGroupBy] = useSessionState<GroupBy>('stats.group', 'day', 'sgroup');

  const buckets = useMemo(() => {
    const windowed = stats.daily.slice(-Number(range));
    return bucketize(windowed, groupBy);
  }, [stats.daily, range, groupBy]);

  const accuracySeries = buckets.map((b) => ({
    label: b.label,
    accuracy: b.reviews ? Math.round((b.correct / b.reviews) * 100) : null,
    reviews: b.reviews,
  }));
  const timeSeries = buckets.map((b) => ({
    label: b.label,
    avgSec: b.secCount ? Math.round(b.secSum / b.secCount) : null,
    sentences: b.sentences,
  }));
  const progressSeries = buckets.map((b) => ({
    label: b.label,
    sentences: b.sentences,
    newItems: b.newItems,
  }));

  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? `${range} ngày`;
  const emptyFor = (kind: 'reviews' | 'sentences' | 'progress', noun: string): string | null => {
    const hasInWindow =
      kind === 'reviews'
        ? accuracySeries.some((b) => b.reviews > 0)
        : kind === 'sentences'
          ? timeSeries.some((b) => b.sentences > 0)
          : progressSeries.some((b) => b.sentences > 0 || b.newItems > 0);
    const hasInYear =
      kind === 'reviews'
        ? stats.daily.some((d) => d.reviews > 0)
        : kind === 'sentences'
          ? stats.daily.some((d) => d.sentences > 0)
          : stats.daily.some((d) => d.sentences > 0 || d.newItems > 0);
    return chartEmptyMessage({ hasInWindow, hasInYear, rangeLabel, noun });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue>{RANGES.find((r) => r.value === range)?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
          <SelectTrigger size="sm" className="w-40">
            <SelectValue>{GROUPS.find((g) => g.value === groupBy)?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {GROUPS.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-4 text-sm">
          <span className="text-muted-foreground">
            Độ chính xác TB:{' '}
            <b className="text-foreground tabular-nums">
              {stats.overallAccuracy == null ? '—' : `${stats.overallAccuracy}%`}
            </b>
          </span>
          <span className="text-muted-foreground">
            Thời gian TB:{' '}
            <b className="text-foreground tabular-nums">
              {stats.overallAvgSec ? `${stats.overallAvgSec}s` : '—'}
            </b>
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Độ chính xác theo thời gian"
          hint="Đường = % đúng mỗi mốc · cột = số lượt ôn · nét đứt = trung bình cả kỳ"
          empty={emptyFor('reviews', 'lượt ôn nào')}
        >
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart
              data={accuracySeries}
              margin={{ top: 6, right: 8, bottom: 0, left: -18 }}
            >
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                minTickGap={16}
              />
              <YAxis
                yAxisId="l"
                domain={[0, 100]}
                tick={axisTick}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="r"
                orientation="right"
                tick={axisTick}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                yAxisId="r"
                dataKey="reviews"
                name="Lượt ôn"
                fill={C.count}
                opacity={0.25}
                radius={[3, 3, 0, 0]}
              />
              {stats.overallAccuracy != null && (
                <ReferenceLine
                  yAxisId="l"
                  y={stats.overallAccuracy}
                  stroke={C.accuracy}
                  strokeDasharray="5 4"
                />
              )}
              <Line
                yAxisId="l"
                type="monotone"
                dataKey="accuracy"
                name="% đúng"
                stroke={C.accuracy}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Thời gian làm bài theo thời gian"
          hint="Đường = giây/câu mỗi mốc · cột = số câu · nét đứt = trung bình cả kỳ"
          empty={emptyFor('sentences', 'câu nào được chấm')}
        >
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={timeSeries} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                minTickGap={16}
              />
              <YAxis yAxisId="l" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis
                yAxisId="r"
                orientation="right"
                tick={axisTick}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                yAxisId="r"
                dataKey="sentences"
                name="Số câu"
                fill={C.count}
                opacity={0.25}
                radius={[3, 3, 0, 0]}
              />
              {stats.overallAvgSec > 0 && (
                <ReferenceLine
                  yAxisId="l"
                  y={stats.overallAvgSec}
                  stroke={C.time}
                  strokeDasharray="5 4"
                />
              )}
              <Line
                yAxisId="l"
                type="monotone"
                dataKey="avgSec"
                name="Giây/câu"
                stroke={C.time}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Tiến độ theo ngày"
          hint="Số câu đã luyện + số mẫu/từ mới giới thiệu mỗi mốc"
          className="lg:col-span-2"
          empty={emptyFor('progress', 'hoạt động nào')}
        >
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart
              data={progressSeries}
              margin={{ top: 6, right: 8, bottom: 0, left: -18 }}
            >
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                minTickGap={16}
              />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="sentences" name="Câu đã luyện" fill={C.time} radius={[3, 3, 0, 0]} />
              <Bar dataKey="newItems" name="Mục mới" fill={C.neu} radius={[3, 3, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <PerfChart title="Điểm & thời gian theo ĐỘ KHÓ (cấp mẫu)" rows={stats.scoreByLevel} />
        <PerfChart title="Điểm & thời gian theo ĐỘ DÀI câu" rows={stats.scoreByLength} />
      </div>
    </div>
  );
}

function PerfChart({ title, rows }: { title: string; rows: PerfBreakdown[] }) {
  const data = rows.map((r) => ({
    label: r.label,
    score: r.avgScore,
    sec: r.avgSec,
    count: r.count,
  }));
  return (
    <ChartCard
      title={title}
      hint="Cột = điểm TB /100 · đường = giây/câu · (1 năm gần nhất)"
      empty={chartEmptyMessage({
        hasInWindow: data.length > 0,
        hasInYear: data.length > 0,
        rangeLabel: '1 năm',
        noun: 'câu nào được chấm',
      })}
    >
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis yAxisId="l" domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="r"
            orientation="right"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar
            yAxisId="l"
            dataKey="score"
            name="Điểm TB"
            fill={C.accuracy}
            radius={[3, 3, 0, 0]}
            maxBarSize={56}
          />
          <Line
            yAxisId="r"
            type="monotone"
            dataKey="sec"
            name="Giây/câu"
            stroke={C.time}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
