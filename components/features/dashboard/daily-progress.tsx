'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DailyStat } from '@/lib/insights/stats';
import { cn } from '@/lib/core/utils';

const WEEKDAYS_VN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const wd = WEEKDAYS_VN[new Date(y, m - 1, d).getDay()];
  return `${wd}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function Row({
  label,
  done,
  total,
  unit,
  caption,
}: {
  label: string;
  done: number;
  total: number;
  unit: string;
  caption?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 100;
  const remaining = Math.max(0, total - done);
  const complete = total === 0 || done >= total;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {done}
          <span className="text-muted-foreground">
            /{total} {unit}
          </span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            complete ? 'bg-ok' : 'bg-accent-brand',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {caption ??
          (complete ? (
            <span className="inline-flex items-center gap-1 text-ok">
              <CheckCircle2 className="size-3.5" aria-hidden /> Đã đạt mục tiêu
            </span>
          ) : (
            `Còn ${remaining} ${unit}`
          ))}
      </p>
    </div>
  );
}

export function DailyProgress({
  daily,
  sessionGoal,
  dailyNewGrammar,
  dueNow,
}: {
  daily: DailyStat[];
  sessionGoal: number;
  dailyNewGrammar: number;
  dueNow: number;
}) {
  const lastIdx = daily.length - 1;
  const [idx, setIdx] = useState(lastIdx);
  const day = daily[idx];
  const isToday = idx === lastIdx;
  if (!day) return null;

  const acc = day.reviews > 0 ? Math.round((day.correct / day.reviews) * 100) : null;
  const reviewCaption =
    day.reviews > 0
      ? `đúng ${day.correct}/${day.reviews} (${acc}%)${isToday && dueNow > 0 ? ` · còn ${dueNow} đến hạn` : ''}`
      : isToday && dueNow > 0
        ? `còn ${dueNow} lượt đến hạn`
        : 'chưa ôn lượt nào';

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
        <h2 className="text-body font-medium text-muted-foreground">
          {isToday ? 'Tiến độ hôm nay' : 'Tiến độ theo ngày'}
        </h2>
        <div className="flex items-center gap-1 max-md:w-full max-md:justify-between">
          {!isToday && (
            <button
              type="button"
              onClick={() => setIdx(lastIdx)}
              className="rounded-md px-2 py-1 text-xs text-accent-brand transition-colors hover:bg-muted"
            >
              Hôm nay
            </button>
          )}
          <button
            type="button"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            aria-label="Ngày trước"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 md:size-7"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="min-w-[9.5rem] text-center text-xs font-medium tabular-nums">
            {dayLabel(day.day)}
          </span>
          <button
            type="button"
            onClick={() => setIdx((i) => Math.min(lastIdx, i + 1))}
            disabled={isToday}
            aria-label="Ngày sau"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 md:size-7"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Row label="Câu đã luyện" done={day.sentences} total={sessionGoal} unit="câu" />
        <Row
          label="Lượt ôn"
          done={day.reviews}
          total={isToday ? day.reviews + dueNow : Math.max(day.reviews, 1)}
          unit="lượt"
          caption={reviewCaption}
        />
        <Row label="Mẫu mới" done={day.newItems} total={dailyNewGrammar} unit="mẫu" />
      </div>
    </div>
  );
}
