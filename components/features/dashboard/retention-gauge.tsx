import { CircleCheck } from 'lucide-react';
import { ChartCard } from '@/components/features/dashboard/dashboard-charts';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/core/utils';
import {
  MIN_REVIEWS_FOR_VERDICT,
  retentionVerdict,
  type RetentionVerdictKind,
  type TrueRetention,
} from '@/lib/srs/retention';

const TONE: Record<RetentionVerdictKind, { text: string; fill: string }> = {
  insufficient: { text: 'text-foreground', fill: 'bg-muted-foreground/40' },
  below: { text: 'text-warn', fill: 'bg-warn/70' },
  'on-target': { text: 'text-ok', fill: 'bg-ok/70' },
  above: { text: 'text-ok', fill: 'bg-ok/70' },
};

// Actual recall against the FSRS target: the number, a bar with the target marked, and the sample
// size as a chip. The verdict and how the number is counted sit behind the (i).
export function RetentionCard({
  actual,
  desired,
  windowDays,
}: {
  actual: TrueRetention;
  desired: number;
  windowDays: number;
}) {
  const verdict = retentionVerdict(actual, desired);
  const actualPct = actual.rate === null ? null : Math.round(actual.rate * 100);
  const targetPct = Math.round(desired * 100);
  const tone = TONE[verdict.kind];
  const insufficient = verdict.kind === 'insufficient';

  return (
    <ChartCard
      icon={CircleCheck}
      title="Nhớ đúng"
      info={
        <>
          {verdict.message} Tính trên {actual.correct}/{actual.reviews} lượt ôn của những mẫu đã vào
          giai đoạn Ôn tập, trong {windowDays} ngày qua, so với mục tiêu {targetPct}%. Các bước Học
          và Học lại không tính, vì chúng không phải phép thử trí nhớ.
        </>
      }
    >
      <div className="flex items-baseline gap-2">
        <span className={cn('text-title1 leading-none font-semibold tabular-nums', tone.text)}>
          {actualPct === null ? '—' : `${actualPct}%`}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">/ {targetPct}%</span>
      </div>

      <div className="relative h-2 w-full rounded-full bg-muted" aria-hidden>
        <div
          className={cn(
            'h-full rounded-full transition-all motion-reduce:transition-none',
            tone.fill,
          )}
          style={{ width: `${actualPct ?? 0}%` }}
        />
        <div
          className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-foreground/70"
          style={{ left: `${targetPct}%` }}
        />
      </div>

      <Badge variant="outline" className="tabular-nums">
        {insufficient
          ? `${actual.reviews}/${MIN_REVIEWS_FOR_VERDICT} lượt`
          : `${actual.reviews} lượt`}
      </Badge>
    </ChartCard>
  );
}
