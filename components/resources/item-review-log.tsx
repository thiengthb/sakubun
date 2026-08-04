import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';
import { SpokenLine } from '@/components/shared/spoken-line';
import { ERROR_TAG_LABELS } from '@/lib/error-tags';
import { formatDueExact, ratingLabel } from '@/lib/format';
import { stripEmoji } from '@/lib/text';
import type { ItemReviewRow } from '@/lib/item-stats';

function RoleBadge({ role }: { role: string }) {
  if (role === 'SECONDARY')
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Phụ
      </Badge>
    );
  return <Badge variant="secondary">Chính</Badge>;
}

/**
 * The full review history for one item: a TABLE from `md` up, a stacked CARD LIST below it — the same
 * split the resource tables make (`DataTable`'s `renderCard`), for the same reason. Six columns cannot
 * be read on a 390px phone: the row slid sideways under its own timestamp column, so the result and the
 * sentence — the two facts you open this section for — were off-screen.
 *
 * The card keeps every field the table has (nothing is dropped, unlike the resource cards, because a
 * review row has six short fields rather than ten): the timestamp and the rating on the first line, the
 * role / error tags / stability as a meta row, and the practised sentence last.
 */
export function ReviewLog({
  reviews,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  reviews: ItemReviewRow[];
  /** TTS settings — the logged sentence is a full Japanese sentence, worth being able to replay. */
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  if (reviews.length === 0)
    return (
      <EmptyState icon={null} className="p-6">
        Chưa ôn lần nào. Lịch sử sẽ hiện ở đây sau khi bạn luyện mục này trong Claude Desktop.
      </EmptyState>
    );
  return (
    <>
      {/* Cards below md. Same `border-border/70` box as every other card list in the app. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {reviews.map((r) => (
          <li key={r.id} className="space-y-1.5 rounded-lg border border-border/70 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{stripEmoji(ratingLabel(r.rating))}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatDueExact(new Date(r.reviewedAt))}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <RoleBadge role={r.role} />
              <span aria-hidden>·</span>
              <span className="tabular-nums">độ bền {r.stability.toFixed(1)} ngày</span>
              {r.errorTags.map((t) => (
                <Badge key={t} variant="outline" className="border-alert/50 text-alert">
                  {ERROR_TAG_LABELS[t]}
                </Badge>
              ))}
            </div>
            {r.sentenceText && (
              <SpokenLine
                text={stripEmoji(r.sentenceText)}
                ruby={r.sentenceRuby}
                showFurigana={showFurigana}
                speaker={voiceSpeaker}
                rate={speechRate}
                label="Nghe câu"
                // No `truncate` here (the table cell has it): the card has a whole line to give, and a
                // sentence clipped at 30 characters is not a sentence you can read back.
                align="start"
                className="text-sm font-normal text-muted-foreground"
              />
            )}
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto max-md:hidden">
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
                {/* stripEmoji: ratingLabel is emoji-decorated for the MCP display-contract; the app UI wants plain text */}
                <TableCell className="whitespace-nowrap">
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
