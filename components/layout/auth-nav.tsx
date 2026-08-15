import Link from 'next/link';

export function AuthNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4">
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
      </div>
    </header>
  );
}
