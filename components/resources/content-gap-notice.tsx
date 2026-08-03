import Link from 'next/link';
import { ArrowRight, FileWarning } from 'lucide-react';

/**
 * Enrichment-card coverage, shown only when patterns the learner is ACTIVELY studying have a card that
 * does not meet the bar — "no card" OR "a card too thin to teach from" (2026-07-27: measured by
 * lib/enrichment-quality, the same definition the tutor's get_library_health uses, so the two surfaces
 * can never report different numbers for the same library).
 *
 * This exists because the gap was invisible: 150 of 153 N5 patterns had no card while every N2/N3/N4
 * pattern did, so the level actually being studied was the one with no content — and no screen said
 * so. A card-less pattern quietly degrades three things at once: the new-item mini-lesson has no
 * `usage`/`contrasts` to read from, the quiz has to invent distractors instead of taking them from
 * `contrasts`, and the detail page's card tab is empty.
 */
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-warn/40 bg-warn/5 p-4">
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
