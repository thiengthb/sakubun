import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Minimal top bar for the chromeless auth pages (login / register). The brand and an explicit
 * "Trang chủ" link both return to the public landing page, so a visitor who lands on the form can
 * always get back out.
 */
export function AuthNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span
            lang="ja"
            aria-hidden
            className="flex size-7 items-center justify-center rounded-md bg-primary text-[11px] font-bold tracking-tighter text-primary-foreground"
          >
            作文
          </span>
          sakubun
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ArrowLeft className="size-4" /> Trang chủ
          </Link>
        </Button>
      </div>
    </header>
  );
}
