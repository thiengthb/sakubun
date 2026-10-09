import Link from 'next/link';
import { ArrowRight, FileWarning } from 'lucide-react';

export function ContentGapNotice({
  studiedWithoutCard,
  enriched,
  total,
}: {
  studiedWithoutCard: number;
  enriched: number;
  total: number;
}) {
  if (studiedWithoutCard === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-warn/40 bg-warn/5 p-4">
      <FileWarning className="size-4 shrink-0 text-warn" aria-hidden />
      <p className="text-sm">
        <span className="font-medium text-warn tabular-nums">{studiedWithoutCard}</span> mẫu bạn
        đang học có thẻ chưa đạt
        <span className="text-muted-foreground">
          {' '}
          — bài giới thiệu mẫu mới, phương án nhiễu của quiz và tab thẻ đều nghèo đi vì thiếu nó.
        </span>
      </p>
      <span className="text-xs text-muted-foreground tabular-nums">
        toàn kho {enriched}/{total} thẻ đạt
      </span>
      <Link
        href="/resources?card=needs-work"
        className="inline-flex items-center gap-1 text-sm text-accent-brand hover:underline"
      >
        Xem các mẫu đó <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
