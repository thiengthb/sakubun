import { cn } from '@/lib/core/utils';

export function AppLogo({ className }: { className?: string }) {
  return (
    <span
      lang="ja"
      aria-hidden
      className={cn(
        'flex size-9 items-center justify-center rounded-sm bg-primary text-xs leading-none font-extrabold tracking-tighter text-primary-foreground shadow-lift-primary',
        className,
      )}
    >
      作文
    </span>
  );
}
