import { cn } from '@/lib/core/utils';

export function AppLogo({ className }: { className?: string }) {
  return (
    <span
      lang="ja"
      aria-hidden
      className={cn(
        'flex size-6 items-center justify-center rounded-md bg-primary text-[10px] font-bold leading-none tracking-tighter text-primary-foreground',
        className,
      )}
    >
      作文
    </span>
  );
}
