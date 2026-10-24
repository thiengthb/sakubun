'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  PenLine,
  Repeat,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DailyStat } from '@/lib/insights/stats';
import { cn } from '@/lib/core/utils';

const WEEKDAYS_VN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const wd = WEEKDAYS_VN[new Date(y, m - 1, d).getDay()];
  return `${wd} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

// One goal of the day as a ring: the icon names it, the ring fills toward the goal and turns green
// when it is met. The sentence that used to sit under each bar is the ring's tooltip.
function Ring({
  icon: Icon,
  label,
  done,
  total,
  tip,
}: {
  icon: LucideIcon;
  label: string;
  done: number;
  total: number;
  tip: string;
}) {
  const ratio = total > 0 ? Math.min(1, done / total) : 1;
  const complete = total === 0 || done >= total;
  return (
    <div
      title={tip}
      className="flex min-w-0 flex-col items-center gap-1.5 text-center sm:flex-row sm:gap-2.5 sm:text-left"
    >
      <div
        aria-hidden
        className="relative size-12 shrink-0 rounded-full transition-all motion-reduce:transition-none"
        style={{
          background: `conic-gradient(var(${complete ? '--ok' : '--accent-brand'}) ${ratio}turn, var(--muted) 0)`,
        }}
      >
        <div className="absolute inset-1 flex items-center justify-center rounded-full bg-card">
          <Icon className={cn('size-4', complete ? 'text-ok' : 'text-accent-brand')} />
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-body font-semibold tabular-nums">
          {done}
          <span className="font-normal text-muted-foreground">/{total}</span>
        </div>
        <div className="truncate text-xs text-muted-foreground">{label}</div>
        <span className="sr-only">{tip}</span>
      </div>
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
  const reviewTip =
    day.reviews > 0
      ? `Đúng ${day.correct}/${day.reviews} lượt (${acc}%)${isToday && dueNow > 0 ? `, còn ${dueNow} đến hạn` : ''}`
      : isToday && dueNow > 0
        ? `Còn ${dueNow} lượt đến hạn`
        : 'Chưa ôn lượt nào';
  const remainTip = (done: number, total: number, unit: string) =>
    done >= total ? 'Đã đạt mục tiêu' : `Còn ${total - done} ${unit}`;

  return (
    <Card className="flex-row flex-wrap items-center gap-x-8 gap-y-3 p-4">
      <div className="flex items-center gap-1 max-sm:w-full max-sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          aria-label="Ngày trước"
        >
          <ChevronLeft />
        </Button>
        {isToday ? (
          <span className="w-20 text-center text-sm font-medium">Hôm nay</span>
        ) : (
          <button
            type="button"
            onClick={() => setIdx(lastIdx)}
            title="Về hôm nay"
            className="w-20 rounded-md text-center text-sm font-medium tabular-nums hover:text-accent-brand focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {dayLabel(day.day)}
          </button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setIdx((i) => Math.min(lastIdx, i + 1))}
          disabled={isToday}
          aria-label="Ngày sau"
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="grid flex-1 grid-cols-3 gap-3 sm:flex sm:flex-wrap sm:gap-x-8">
        <Ring
          icon={PenLine}
          label="Câu"
          done={day.sentences}
          total={sessionGoal}
          tip={remainTip(day.sentences, sessionGoal, 'câu')}
        />
        <Ring
          icon={Repeat}
          label="Lượt ôn"
          done={day.reviews}
          total={isToday ? day.reviews + dueNow : Math.max(day.reviews, 1)}
          tip={reviewTip}
        />
        <Ring
          icon={Sparkles}
          label="Mẫu mới"
          done={day.newItems}
          total={dailyNewGrammar}
          tip={remainTip(day.newItems, dailyNewGrammar, 'mẫu')}
        />
      </div>
    </Card>
  );
}
