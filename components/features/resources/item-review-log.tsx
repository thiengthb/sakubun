import { cn } from '@/lib/core/utils';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/common/empty-state';
import { SpokenLine } from '@/components/common/spoken-line';
import { ERROR_TAG_LABELS } from '@/lib/session/error-tags';
import { formatDueExact, ratingLabel } from '@/lib/core/format';
import { stripEmoji } from '@/lib/core/text';
import type { ItemReviewRow } from '@/lib/insights/item-stats';

function RoleBadge({ role }: { role: string }) {
  if (role === 'SECONDARY')
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Phụ
      </Badge>
    );
  return <Badge variant="secondary">Chính</Badge>;
}

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
  if (reviews.length === 0)
    return (
      <EmptyState icon={null} className="p-6">
        Chưa ôn lần nào. Lịch sử sẽ hiện ở đây sau khi bạn luyện mục này qua Claude Desktop hoặc
        ChatGPT.
      </EmptyState>
    );
  return (
    <>
      {/* Narrow column: one list, months as dividers, one row per review: what you answered first. */}
      <div className="overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10 @2xl:hidden">
        {byMonth(reviews).map(([month, rows]) => (
          <section key={month}>
            <h3 className="bg-muted/70 px-3 py-1 text-xs font-bold text-muted-foreground">
              {month}
            </h3>
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="space-y-1 px-3 py-2.5">
                  <div className="flex items-center gap-2">
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
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatDueExact(new Date(r.reviewedAt))}
                    </span>
                  </div>
                  <div className="pl-4 text-xs text-muted-foreground tabular-nums">
                    {r.role === 'SECONDARY' ? 'Vai phụ' : 'Vai chính'} · độ bền{' '}
                    {r.stability.toFixed(1)} ngày
                  </div>
                  {r.sentenceText && (
                    <div className="pl-4">
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
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="overflow-x-auto @max-2xl:hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Thời điểm</TableHead>
              <TableHead>Kết quả</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Lỗi</TableHead>
              <TableHead className="whitespace-nowrap">Độ bền sau</TableHead>
              <TableHead className="w-[26%]">Câu luyện</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                  {formatDueExact(new Date(r.reviewedAt))}
                </TableCell>
                <TableCell className="whitespace-nowrap font-bold">
                  <span
                    aria-hidden
                    className={cn(
                      'mr-2 inline-block size-2 rounded-sm',
                      RATING_DOT[r.rating] ?? 'bg-muted-foreground',
                    )}
                  />
                  {stripEmoji(ratingLabel(r.rating))}
                </TableCell>
                <TableCell>
                  <RoleBadge role={r.role} />
                </TableCell>
                <TableCell>
                  {r.errorTags.length ? (
                    <div className="flex flex-wrap gap-1">
                      {r.errorTags.map((t) => (
                        <Badge key={t} variant="outline" className="border-alert/50 text-alert">
                          {ERROR_TAG_LABELS[t]}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {r.stability.toFixed(1)} ngày
                </TableCell>
                <TableCell>
                  {r.sentenceText ? (
                    <SpokenLine
                      text={stripEmoji(r.sentenceText)}
                      ruby={r.sentenceRuby}
                      showFurigana={showFurigana}
                      speaker={voiceSpeaker}
                      rate={speechRate}
                      label="Nghe câu"
                      truncate
                      className="font-normal text-muted-foreground"
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
