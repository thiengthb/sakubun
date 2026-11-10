import { cn } from '@/lib/core/utils';

export function AppLogo({ className }: { className?: string }) {
  return (
    <span
      lang="ja"
      aria-hidden
      className={cn(
        'mb-0.5 flex h-8.5 w-9 items-center justify-center rounded-sm bg-primary text-xs leading-none font-extrabold tracking-tighter text-primary-foreground shadow-lift-primary',
        className,
      )}
    >
      作文
    </span>
  );
}
