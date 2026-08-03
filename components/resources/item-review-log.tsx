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

/** The full review history table for one item (empty state when it has never been reviewed). */
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
    <div className="overflow-x-auto">
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
  );
}
