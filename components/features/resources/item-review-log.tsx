import { History } from 'lucide-react';
import { cn } from '@/lib/core/utils';
import { LIST_CARD } from '@/components/common/list-card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/empty-state';
import { SpokenLine } from '@/components/common/spoken-line';
import { ERROR_TAG_LABELS } from '@/lib/session/error-tags';
import { formatDueExact, ratingLabel } from '@/lib/core/format';
import { stripEmoji } from '@/lib/core/text';
import type { ItemReviewRow } from '@/lib/insights/item-stats';

const RATING_DOT: Record<number, string> = {
  1: 'bg-alert',
  2: 'bg-warn',
  3: 'bg-ok',
  4: 'bg-info',
};

function byMonth(reviews: ItemReviewRow[]): [string, ItemReviewRow[]][] {
  const groups = new Map<string, ItemReviewRow[]>();
  for (const r of reviews) {
    const d = new Date(r.reviewedAt);
    const key = `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()];
}

export function ReviewLog({
  reviews,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  reviews: ItemReviewRow[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  if (reviews.length === 0) return <EmptyState icon={History} title="Chưa ôn lần nào" />;
  // thien loved the step-4 phone design (2026-10-24) and wants it at every width: one list,
  // months as dividers, one row per review with a rating dot. From @2xl the row's parts sit on
  // one line: result, role and stability, the sentence, the time.
  return (
    <div className={cn(LIST_CARD.base, 'overflow-hidden p-0')}>
      {byMonth(reviews).map(([month, rows]) => (
        <section key={month}>
          <h3 className="bg-muted/70 px-3 py-1 text-xs font-bold text-muted-foreground">{month}</h3>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-3 py-2.5 @2xl:grid-cols-[minmax(9rem,auto)_9rem_minmax(0,1fr)_auto] @2xl:items-center"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      'size-2 shrink-0 rounded-sm',
                      RATING_DOT[r.rating] ?? 'bg-muted-foreground',
                    )}
                  />
                  <span className="font-bold">{stripEmoji(ratingLabel(r.rating))}</span>
                  {r.errorTags.map((t) => (
                    <Badge key={t} variant="outline" className="border-alert/50 text-alert">
                      {ERROR_TAG_LABELS[t]}
                    </Badge>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums @2xl:order-last">
                  {formatDueExact(new Date(r.reviewedAt))}
                </span>
                <div className="col-span-2 pl-4 text-xs text-muted-foreground tabular-nums @2xl:col-span-1 @2xl:pl-0">
                  {r.role === 'SECONDARY' ? 'Vai phụ' : 'Vai chính'} · độ bền{' '}
                  {r.stability.toFixed(1)} ngày
                </div>
                <div className="col-span-2 min-w-0 pl-4 empty:hidden @2xl:col-span-1 @2xl:pl-0">
                  {r.sentenceText && (
                    <SpokenLine
                      text={stripEmoji(r.sentenceText)}
                      ruby={r.sentenceRuby}
                      showFurigana={showFurigana}
                      speaker={voiceSpeaker}
                      rate={speechRate}
                      label="Nghe câu"
                      align="start"
                      className="text-sm font-normal text-muted-foreground"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
