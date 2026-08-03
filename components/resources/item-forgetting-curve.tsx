function pct(r: number): string {
  return `${Math.round(r * 100)}%`;
}

/**
 * Forgetting-curve mini chart. Plots recall probability (r, 0–1) against days since the last review;
 * r is squashed into the [0.5, 1] band so the gentle decay is actually visible. Renders DATA (allowed
 * SVG per the icon rule), scales to the container width via preserveAspectRatio="none" + non-scaling
 * strokes so lines stay crisp. Marks "now" (a dot) and the due day (dashed line).
 */
export function ForgettingCurve({
  points,
  nowDay,
  dueDay,
  retention,
  currentR,
}: {
  points: { day: number; r: number }[];
  nowDay: number;
  dueDay: number;
  retention: number;
  currentR: number | null;
}) {
  const maxDay = points[points.length - 1]?.day || 1;
  const x = (day: number) => (day / maxDay) * 100;
  // Squash r∈[0.5,1] → y∈[100(bottom),0(top)]; clamp below 0.5 to the floor.
  const y = (r: number) => (1 - Math.max(0, (Math.min(1, r) - 0.5) / 0.5)) * 100;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.day)},${y(p.r)}`).join(' ');
  const area = `${line} L${x(maxDay)},100 L0,100 Z`;
  const dueX = x(Math.min(dueDay, maxDay));
  const showNow = nowDay >= 0 && nowDay <= maxDay && currentR != null;

  return (
    <div className="space-y-2">
      <div className="relative h-32 w-full">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-brand)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent-brand)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#curveFill)" />
          <path
            d={line}
            fill="none"
            stroke="var(--accent-brand)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {/* Due marker — where the app schedules the next review (r ≈ desired retention). */}
          <line
            x1={dueX}
            y1="0"
            x2={dueX}
            y2="100"
            stroke="var(--muted-foreground)"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
          {showNow && (
            <circle
              cx={x(nowDay)}
              cy={y(currentR)}
              r="3"
              fill="var(--accent-brand)"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <span className="absolute top-0 right-0 translate-x-1 text-[0.625rem] text-muted-foreground">
          hạn ~{pct(retention)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Đường cong quên: khả năng nhớ tụt dần từ 100% (ngay sau khi ôn). App hẹn ôn lại khi rơi về
        mức mong muốn (~{pct(retention)}).{' '}
        {showNow && currentR != null && (
          <span className="text-foreground">Hiện tại: còn nhớ ~{pct(currentR)}.</span>
        )}
      </p>
    </div>
  );
}
