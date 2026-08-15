import { cn } from '@/lib/core/utils';
import { retentionVerdict, type RetentionVerdictKind, type TrueRetention } from '@/lib/srs/retention';

export function RetentionGauge({
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

  const toneByKind: Record<RetentionVerdictKind, { text: string; fill: string }> = {
    insufficient: { text: 'text-muted-foreground', fill: 'bg-muted-foreground/40' },
    below: { text: 'text-warn', fill: 'bg-warn/70' },
    'on-target': { text: 'text-ok', fill: 'bg-ok/70' },
    above: { text: 'text-ok', fill: 'bg-ok/70' },
  };
  const tone = toneByKind[verdict.kind];

  if (verdict.kind === 'insufficient') {
    return (
      <div className="space-y-2">
        <p className="text-sm">{verdict.message}</p>
        <p className="text-xs text-muted-foreground">
          Đang có <span className="tabular-nums">{actual.correct}</span>/
          <span className="tabular-nums">{actual.reviews}</span> lượt đúng
          {actualPct === null ? '' : ` (${actualPct}%)`} ở những mẫu đã vào giai đoạn Ôn tập, trong{' '}
          <span className="tabular-nums">{windowDays}</span> ngày qua. Chưa so với mục tiêu{' '}
          <span className="tabular-nums">{targetPct}%</span> vì mẫu còn quá nhỏ để con số nói được điều
          gì.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className={cn('text-3xl font-semibold tabular-nums', tone.text)}>
          {actualPct === null ? '—' : `${actualPct}%`}
        </span>
        <span className="text-sm text-muted-foreground">
          bạn thực sự nhớ được · mục tiêu <span className="tabular-nums">{targetPct}%</span>
        </span>
      </div>

      <div className="relative h-2.5 w-full rounded-full bg-muted" aria-hidden>
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
          title={`Mục tiêu ${targetPct}%`}
        />
      </div>

      <p className="text-sm text-muted-foreground">{verdict.message}</p>

      <p className="text-xs text-muted-foreground">
        Tính trên <span className="tabular-nums">{actual.correct}</span>/
        <span className="tabular-nums">{actual.reviews}</span> lượt ôn của những mẫu đã vào giai
        đoạn Ôn tập, trong <span className="tabular-nums">{windowDays}</span> ngày qua. Các bước Học
        và Học lại không tính, vì chúng không phải phép thử trí nhớ.
      </p>
    </div>
  );
}
