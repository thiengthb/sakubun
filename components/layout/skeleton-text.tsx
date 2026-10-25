import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/core/utils';

/**
 * A word the loading screen cannot know yet (an item's name, whether it is grammar or vocab): the
 * likely text, invisible, with a bar over it. It sits in the line as the real word will, so the
 * header keeps its height and the words around it stay put. e2e/skeleton.spec.ts reads
 * `data-pending` as "any text here".
 */
export function SkeletonText({ text, className }: { text: string; className?: string }) {
  return (
    <span data-pending className={cn('relative inline-block max-w-full align-top', className)}>
      <span className="invisible">{text}</span>
      <Skeleton aria-hidden className="absolute inset-x-0 inset-y-0.5 rounded-sm" />
    </span>
  );
}
