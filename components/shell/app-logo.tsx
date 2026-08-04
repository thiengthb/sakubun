import { cn } from '@/lib/utils';

/**
 * The sakubun brand mark (作文 badge). Shared by the sidebar brand and the mobile top bar so the app
 * icon is identical everywhere and lives in one place. Decorative (aria-hidden) — the app name sits
 * beside it in the sidebar; on the mobile bar it stands in for the (hidden) sidebar brand.
 */
export function AppLogo({ className }: { className?: string }) {
  return (
    <span
      lang="ja"
      aria-hidden
      className={cn(
        'flex size-6 items-center justify-center rounded-lg bg-primary text-[10px] font-bold leading-none tracking-tighter text-primary-foreground',
        className,
      )}
    >
      作文
    </span>
  );
}
