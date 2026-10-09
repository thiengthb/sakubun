import { cn } from '@/lib/utils';

export function SectionTag({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2 font-bold text-foreground', className)}>
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent-brand" />
      {children}
    </span>
  );
}
