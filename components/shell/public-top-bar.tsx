import Link from 'next/link';
import { BookOpenText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/shell/app-logo';
import { cn } from '@/lib/utils';

/**
 * The ONE chrome a signed-OUT visitor gets: brand on the left, sign-in on the right. Used by the
 * guest-viewable `/guide` (see `app-shell.tsx`) so a stranger reading the guide is not dropped inside
 * the app sidebar, whose every link would bounce them to /login.
 *
 * No sign-up CTA: this is a single-user app and registration closes for good once that user exists
 * (see the /register gate), so offering it to a visitor would only lead to a rejection.
 *
 * `guide` adds the "Hướng dẫn" link — off on the guide itself (a link to the page you are already on
 * is noise).
 */
export function PublicTopBar({
  containerClassName,
  guide = false,
}: {
  /** Width/padding of the inner row — match the page it sits above. */
  containerClassName?: string;
  guide?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div
        className={cn(
          'mx-auto flex h-15 w-full max-w-6xl items-center justify-between px-5 py-2.5 sm:px-6',
          containerClassName,
        )}
      >
        <Link href="/" className="flex min-w-0 items-center gap-2.5 font-semibold">
          <AppLogo />
          <span className="min-w-0 leading-tight">
            sakubun
            <span className="block truncate text-xs font-normal text-muted-foreground max-sm:hidden">
              Luyện dịch Nhật–Việt
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-1.5 sm:gap-2">
          {guide && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/guide">
                <BookOpenText className="size-4" />
                {/* sr-only, NOT hidden: below sm this collapsed to an icon-only link with no
                    accessible name at all (axe link-name). sr-only keeps the label for a screen
                    reader while the icon stands alone visually. */}
                <span className="max-sm:sr-only">Hướng dẫn</span>
              </Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link href="/login">Đăng nhập</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
