'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import {
  Bell,
  BookText,
  CheckCheck,
  Download,
  Heart,
  MessageSquare,
  PenLine,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { Explain } from '@/components/shared/explain';
import { RelativeTime } from '@/components/shared/relative-time';
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/app/actions';
import type { NotificationRow } from '@/lib/notifications';
import { cn } from '@/lib/utils';

/**
 * Icon + one-line explanation PER KIND, in one place so the bell popover and this page can never
 * disagree about what an event means. The explanation answers "why am I being told this", which is the
 * question a feed stops being read for failing to answer.
 */
const KIND_META: Record<string, { icon: LucideIcon; explain: string }> = {
  SENTENCE_GRADED: {
    icon: PenLine,
    explain: 'Claude đã chấm xong một lượt luyện. Bấm để mở đúng bài đó trong Lịch sử.',
  },
  ITEMS_ADDED: {
    icon: BookText,
    explain: 'Có mục mới vào kho — thường do Claude thêm trong lúc bạn luyện hoặc tra từ.',
  },
  ITEMS_UPDATED: { icon: PenLine, explain: 'Thẻ giải thích của một số mục vừa được bổ sung.' },
  ITEMS_DELETED: {
    icon: Trash2,
    explain: 'Có mục bị xóa khỏi kho. Lịch sử ôn của mục đã xóa vẫn được giữ lại.',
  },
  ITEM_FORKED: { icon: Download, explain: 'Ai đó lấy mục bạn chia sẻ về kho riêng của họ.' },
  SENTENCE_LIKED: { icon: Heart, explain: 'Ai đó thích một câu bạn đã chia sẻ lên cộng đồng.' },
  SENTENCE_COMMENTED: { icon: MessageSquare, explain: 'Có bình luận mới về câu bạn chia sẻ.' },
  COMMENT_VOTED: {
    icon: MessageSquare,
    explain: 'Bình luận của bạn được tán thành hoặc phản đối.',
  },
  LEECH_DETECTED: {
    icon: TriangleAlert,
    explain: 'Một mẫu bạn sai đi sai lại nhiều lần — nên học lại từ đầu thay vì ôn tiếp.',
  },
  CALIBRATION_PROPOSED: {
    icon: SlidersHorizontal,
    explain:
      'App đề xuất chỉnh độ khó dựa trên kết quả của bạn. Hiện chỉ là đề xuất — không có gì tự đổi.',
  },
  USER_REGISTERED: {
    icon: UserPlus,
    explain: 'Có tài khoản mới (chỉ quản trị viên thấy dòng này).',
  },
};

/**
 * The full notification list. Read/unread is the ONLY state — there is no archive, so nothing the
 * learner has seen can quietly disappear from the record.
 */
export function NotificationsView({ items }: { items: NotificationRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = items.filter((n) => !n.readAt).length;

  const open = (n: NotificationRow) => {
    if (!n.readAt) start(() => void markNotificationReadAction(n.id).then(() => router.refresh()));
    if (n.href) router.push(n.href);
  };

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="Chưa có thông báo nào"
        description="Khi Claude thêm mẫu, chấm bài, hoặc có người tương tác với thứ bạn chia sẻ, mọi thứ sẽ hiện ở đây — kể cả khi bạn đang không mở app."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          {unread > 0 ? `${unread} chưa đọc · ${items.length} tất cả` : `${items.length} thông báo`}
        </p>
        {unread > 0 && (
          <Explain text="Đánh dấu tất cả là đã đọc. Không xóa gì — các dòng vẫn nằm nguyên trong danh sách.">
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(() => void markAllNotificationsReadAction().then(() => router.refresh()))
              }
            >
              <CheckCheck className="size-4" aria-hidden />
              Đánh dấu đã đọc hết
            </Button>
          </Explain>
        )}
      </div>

      <ul className="divide-y rounded-lg border">
        {items.map((n) => {
          const meta = KIND_META[n.kind] ?? { icon: Bell, explain: 'Một sự kiện trong app.' };
          const Icon = meta.icon;
          return (
            <li key={n.id}>
              <Explain text={meta.explain} side="right">
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted',
                    !n.readAt && 'bg-primary/5',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border',
                      n.readAt
                        ? 'text-muted-foreground'
                        : 'border-primary/30 bg-primary/10 text-primary',
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className={cn('block truncate', !n.readAt && 'font-medium')}>
                      {n.title}
                      {n.count > 1 && (
                        <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                          ×{n.count}
                        </span>
                      )}
                    </span>
                    {n.body && (
                      <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                    )}
                    <RelativeTime
                      value={n.updatedAt}
                      className="block text-xs text-muted-foreground"
                    />
                  </span>
                  {!n.readAt && (
                    <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              </Explain>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
