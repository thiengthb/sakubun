'use client';

import { useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  PenLine,
  Repeat,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DailyStat } from '@/lib/insights/dashboard-model';
import { TapTooltip } from '@/components/common/info-tooltip';
import { cn } from '@/lib/core/utils';

const WEEKDAYS_VN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const wd = WEEKDAYS_VN[new Date(y, m - 1, d).getDay()];
  return `${wd} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

interface Goal {
  icon: LucideIcon;
  /** The quest's name on wider screens. */
  label: string;
  /** The ring's shorter name on a phone. */
  short: string;
  done: number;
  total: number;
  tip: string;
}

// One goal of the day as a ring: the icon names it, the ring fills toward the goal and turns green
// when it is met. The sentence that used to sit under each bar is the ring's tooltip, which a tap
// opens too.
function Ring({ icon: Icon, short, done, total, tip }: Goal) {
  const ratio = total > 0 ? Math.min(1, done / total) : 1;
  const complete = total === 0 || done >= total;
  return (
    <TapTooltip content={tip}>
      <button
        type="button"
        className="flex min-w-0 flex-col items-center gap-2 rounded-lg text-center focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div
          aria-hidden
          className="relative size-14 shrink-0 rounded-full transition-all motion-reduce:transition-none"
          style={{
            background: `conic-gradient(var(${complete ? '--ok' : '--accent-brand'}) ${ratio}turn, var(--muted) 0)`,
          }}
        >
          <div className="absolute inset-1.5 flex items-center justify-center rounded-full bg-card">
            <Icon className={cn('size-4', complete ? 'text-ok' : 'text-accent-brand')} />
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-base font-semibold tabular-nums">
            {done}
            <span className="font-normal text-muted-foreground">/{total}</span>
          </div>
          <div className="truncate text-xs text-muted-foreground">{short}</div>
          <span className="sr-only">{tip}</span>
        </div>
      </button>
    </TapTooltip>
  );
}

// One goal of the day as a Duolingo quest: icon tile, then the name and count over a thick bar.
function Quest({ icon: Icon, label, done, total, tip }: Goal) {
  const ratio = total > 0 ? Math.min(1, done / total) : 1;
  const complete = total === 0 || done >= total;
  return (
    <TapTooltip content={tip}>
      <button
        type="button"
        className="flex min-w-0 items-center gap-3 rounded-lg text-left focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          aria-hidden
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            complete ? 'bg-ok-wash text-ok' : 'bg-warn-wash text-accent-brand',
          )}
        >
          {complete ? <Check className="size-4" /> : <Icon className="size-4" />}
        </span>
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {done}
              <span className="font-normal text-muted-foreground">/{total}</span>
            </span>
          </span>
          <span className="block h-3 overflow-hidden rounded-full bg-muted">
            <span
              className={cn(
                'block h-full rounded-full transition-all motion-reduce:transition-none',
                complete ? 'bg-ok' : 'bg-accent-brand',
              )}
              style={{ width: `${ratio * 100}%` }}
            />
          </span>
          <span className="sr-only">{tip}</span>
        </span>
      </button>
    </TapTooltip>
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

  const goals: Goal[] = [
    {
      icon: PenLine,
      label: 'Luyện câu',
      short: 'Câu',
      done: day.sentences,
      total: sessionGoal,
      tip: remainTip(day.sentences, sessionGoal, 'câu'),
    },
    {
      icon: Repeat,
      label: 'Ôn đến hạn',
      short: 'Lượt ôn',
      done: day.reviews,
      total: isToday ? day.reviews + dueNow : Math.max(day.reviews, 1),
      tip: reviewTip,
    },
    {
      icon: Sparkles,
      label: 'Học mẫu mới',
      short: 'Mẫu mới',
      done: day.newItems,
      total: dailyNewGrammar,
      tip: remainTip(day.newItems, dailyNewGrammar, 'mẫu'),
    },
  ];
  // Title left, day nav right; the three goals share the width equally under it. Quests when the
  // card is wide enough for three names and bars side by side, rings when it is not (a phone, a
  // tablet beside the sidebar), where a quest's name would be cut to "Lu...". thien, Phân tích
  // round 2.
  return (
    <Card className="gap-4 p-4">
      <div className="flex min-w-0 items-center gap-2">
        <h3 className="truncate text-sm font-semibold">
          {isToday ? 'Hôm nay' : dayLabel(day.day)}
        </h3>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {!isToday && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setIdx(lastIdx)}>
              Về hôm nay
            </Button>
          )}
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
      </div>
      <div className="@container">
        <div className="grid grid-cols-3 gap-4 @2xl:hidden">
          {goals.map((g) => (
            <Ring key={g.label} {...g} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-6 @max-2xl:hidden">
          {goals.map((g) => (
            <Quest key={g.label} {...g} />
          ))}
        </div>
      </div>
    </Card>
  );
}
