import { cn } from '@/lib/utils';

/**
 * A section label rendered as bold text with a small leading dot in the app theme color — the shared
 * heading treatment for the content blocks of an item (enrichment sections, the vocab example, the
 * lesson page sections). Was a filled tag/badge until 2026-07-21; a plain bold heading with a themed
 * bullet reads as a real section title instead of a chip glued to the content. The dot color comes
 * from the CSS var (accent-brand), so dark/light both work with no hardcoded value.
 */
export function SectionTag({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2 font-bold text-foreground', className)}>
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent-brand" />
      {children}
    </span>
  );
}
