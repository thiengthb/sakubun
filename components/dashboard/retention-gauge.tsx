import { cn } from '@/lib/utils';
import { retentionVerdict, type RetentionVerdictKind, type TrueRetention } from '@/lib/retention';

/**
 * Measured retention against the target FSRS schedules to. Rendered as ChartCard content, matching
 * the dashboard's other pure-CSS, server-rendered charts (no chart dependency).
 *
 * The verdict sentence is the point of the card: a bare "73%" is a number, "you are forgetting more
 * than the schedule assumes" is something the learner can act on.
 */
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

  // Chưa đủ bằng chứng thì KHÔNG vẽ phép so sánh. Trước 2026-08-12 thẻ này vẫn in con số 53% ở cỡ 3xl
  // và vẫn tô thanh tới 53% với vạch mục tiêu ở 90%, rồi mới nói bên dưới là chưa kết luận được. Hình
  // ảnh đó là một phát biểu — "bạn thua xa mục tiêu" — và người đọc nhận cỡ chữ với màu trước khi đọc
  // câu, nên phần chữ đúng bị phần hình sai đè. Cùng lớp lỗi với ô điểm trống (`lib/score-label.ts`):
  // hiển thị một con số như thể nó có nghĩa trong khi app BIẾT là chưa.
  //
  // Ở trạng thái này, thứ duy nhất hành động được là "còn bao nhiêu lượt nữa" — nên nó thành nội dung
  // chính, và con số thô tụt xuống hàng phụ để người học vẫn thấy nó đang lớn dần.
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

      {/* Track with the target marked, so the gap is visible rather than arithmetic. */}
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
