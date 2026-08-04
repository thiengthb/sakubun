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
import type { DailyStat, StudyStats } from '@/lib/stats';
import type { PerfBreakdown } from '@/lib/analytics';

// Theme-aware chart colours (resolve to real values + follow dark/light via the @theme tokens).
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

/** Bucket the daily series by the chosen grouping (chronological, except weekday which folds all weeks). */
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
      // week: bucket by the Monday of each day's week
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
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/**
 * The "Thống kê" tab charts (on the Phân tích page). The server hands over a 365-day daily series; this
 * client windows it (30/90/365)
 * and groups it (day/week/month/weekday) for the accuracy + time + progress charts, and renders the
 * score/time-by-difficulty + by-length breakdowns. Time-series charts overlay per-bucket counts (bars)
 * with the metric line and a dashed window-average reference line.
 */
export function StatsView({ stats }: { stats: StudyStats }) {
  // Persist the window + grouping across reload / navigation (URL-mirrored), like the other views —
  // so returning to the Thống kê tab keeps the "365 ngày · theo tuần" view the learner last chose.
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

  return (
    <div className="space-y-6">
      {/* Controls + headline numbers */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
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
            <SelectValue />
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

      <div className="grid gap-4 lg:grid-cols-2">
        <PerfChart title="Điểm & thời gian theo ĐỘ KHÓ (cấp mẫu)" rows={stats.scoreByLevel} />
        <PerfChart title="Điểm & thời gian theo ĐỘ DÀI câu" rows={stats.scoreByLength} />
      </div>
    </div>
  );
}

/** Score (bars, /100) + time-to-answer (line, s) across difficulty/length groups — over the 1-year window. */
function PerfChart({ title, rows }: { title: string; rows: PerfBreakdown[] }) {
  const data = rows.map((r) => ({
    label: r.label,
    score: r.avgScore,
    sec: r.avgSec,
    count: r.count,
  }));
  return (
    <ChartCard title={title} hint="Cột = điểm TB /100 · đường = giây/câu · (1 năm gần nhất)">
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Chưa đủ dữ liệu.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
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
              yAxisId="l"
              dataKey="score"
              name="Điểm TB"
              fill={C.accuracy}
              radius={[3, 3, 0, 0]}
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
      )}
    </ChartCard>
  );
}
