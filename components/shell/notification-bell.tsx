'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Explain } from '@/components/shared/explain';
import { RelativeTime } from '@/components/shared/relative-time';
import {
  getNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/app/actions';
import type { NotificationRow } from '@/lib/notifications';
import { cn } from '@/lib/utils';

/**
 * The bell — far right of the breadcrumb row on every page (`PageShell` renders it, so it cannot drift
 * per route; the app shell deliberately has no top header, the breadcrumb row IS the horizontal bar).
 *
 * It fetches its OWN data through a server action instead of receiving it as a prop. That is not the
 * first design: passing it down from `PageShell` was, until `PageShell` turned out to be imported by
 * client components too (settings-form), which made an async server-only PageShell pull the auth module
 * — and nodemailer behind it — into a browser bundle. A server action keeps the data server-side with
 * no endpoint to secure and no constraint on who renders the shell.
 *
 * Refreshes on mount, when the tab regains focus, and on a slow interval — the same triggers as
 * `LiveRefresh`, at a fifth of the rate, because a notification arriving 30 seconds late costs nothing.
 *
 * The badge is an INDICATOR, not a notification: it is ambient and must never demand action. That is
 * why nothing here auto-opens, and why the count is capped visually at 9+ rather than growing wider and
 * wider until it becomes the loudest thing on the page.
 */
const REFRESH_MS = 60_000;

export function NotificationBell() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  // null = not resolved yet (first paint), false = signed out. The bell renders for a MEMBER even with
  // an empty feed — it is a fixed control on every page, not something that appears once there is news.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  // The fetch lives INSIDE the effect and both setState calls sit after an `await`, so nothing is set
  // synchronously during the effect (react-hooks/set-state-in-effect). `alive` drops a response that
  // arrives after unmount — navigating away mid-poll must not write to a dead component.
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await getNotificationsAction();
        if (!alive) return;
        setSignedIn(data !== null);
        setItems(data?.items ?? []);
        setUnread(data?.unread ?? 0);
      } catch {
        // A failed poll leaves the last known state alone; the bell must never break the page it sits on.
      }
    };
    void load();
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const id = setInterval(refreshIfVisible, REFRESH_MS);
    window.addEventListener('focus', refreshIfVisible);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener('focus', refreshIfVisible);
    };
  }, [tick]);

  const open = (n: NotificationRow) => {
    // Mark read FIRST so the badge is already correct when the destination renders; the navigation is
    // what the user asked for and must not wait on it.
    if (!n.readAt) start(() => void markNotificationReadAction(n.id).then(reload));
    if (n.href) router.push(n.href);
  };

  // Absent only for a guest (/guide is guest-viewable). While the first fetch is in flight the bell is
  // already rendered, so the header row does not reflow when the answer arrives.
  if (signedIn === false) return null;

  return (
    <Popover>
      <Explain
        text={
          unread > 0
            ? `${unread} thông báo chưa đọc`
            : 'Thông báo — mọi thứ đã xảy ra khi bạn không nhìn màn hình'
        }
      >
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label="Thông báo">
            <Bell className="size-4" aria-hidden />
            {unread > 0 && (
              <span
                aria-hidden
                className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-xs leading-4 font-semibold text-primary-foreground tabular-nums"
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
      </Explain>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="font-medium">Thông báo</span>
          {unread > 0 && (
            <Explain text="Đánh dấu tất cả là đã đọc. Các thông báo vẫn nằm trong danh sách, chỉ hết đậm.">
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => start(() => void markAllNotificationsReadAction().then(reload))}
              >
                <CheckCheck className="size-3.5" aria-hidden />
                Đọc hết
              </Button>
            </Explain>
          )}
        </div>

        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-muted-foreground">
            Chưa có thông báo nào. Khi Claude thêm mẫu, chấm bài, hoặc có người tương tác với câu
            bạn chia sẻ, nó sẽ hiện ở đây.
          </p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={cn(
                    'flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-muted',
                    !n.readAt && 'bg-primary/5',
                  )}
                >
                  <span className="flex items-start gap-2">
                    {!n.readAt && (
                      <span
                        aria-hidden
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                      />
                    )}
                    <span className={cn('min-w-0 flex-1', !n.readAt && 'font-medium')}>
                      {n.title}
                    </span>
                  </span>
                  {n.body && (
                    <span className="line-clamp-2 pl-3.5 text-xs text-muted-foreground">
                      {n.body}
                    </span>
                  )}
                  <RelativeTime
                    value={n.updatedAt}
                    className="pl-3.5 text-xs text-muted-foreground"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t px-3 py-2">
          <Link href="/notifications" className="text-primary hover:underline">
            Xem tất cả
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
