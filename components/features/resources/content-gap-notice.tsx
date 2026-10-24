import Link from 'next/link';
import { FileWarning } from 'lucide-react';
import { Explain } from '@/components/common/explain';

// A chip in the dashboard header: how many studied patterns have a card that is not good enough.
// The why (intro, quiz distractors and the card tab all get poorer) is its tooltip, not a banner.
export function ContentGapChip({
  studiedWithoutCard,
  enriched,
  total,
}: {
  studiedWithoutCard: number;
  enriched: number;
  total: number;
}) {
  if (studiedWithoutCard === 0) return null;
  const why = `${studiedWithoutCard} mẫu bạn đang học có thẻ chưa đạt: bài giới thiệu, phương án nhiễu của quiz và tab thẻ đều nghèo đi vì thiếu nó. Toàn kho ${enriched}/${total} thẻ đạt.`;

  return (
    <Explain text={why}>
      <Link
        href="/resources?card=needs-work"
        aria-label={`${studiedWithoutCard} thẻ thiếu, xem các mẫu đó`}
        className="target-44 ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-sm md:h-7 bg-warn-wash px-2.5 text-sm font-medium text-warn transition-colors hover:bg-warn/15 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <FileWarning className="size-4" aria-hidden />
        <span className="tabular-nums">{studiedWithoutCard}</span>
        <span className="max-sm:sr-only">thẻ thiếu</span>
      </Link>
    </Explain>
  );
}
