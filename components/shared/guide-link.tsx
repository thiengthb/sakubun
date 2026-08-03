import Link from 'next/link';
import { BookOpenText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GuideRecipeId, GuideTabId, GuideTopicId } from '@/components/guide/guide-topic-meta';

/**
 * A link from the screen a question ARISES ON to the exact place in `/guide` that answers it — the point
 * of making topics/recipes addressable. Put one wherever a user can get stuck: an empty store, the MCP
 * token card, an item with no enrichment card.
 *
 * The target is TYPED (`GuideTopicId` / `GuideRecipeId` / `GuideTabId`), so a link can never point at a
 * topic or recipe that does not exist — the compiler is the gate here, no regex test needed. Exactly one
 * of the three is allowed per link.
 *
 * Deliberately quiet (one small line, no card/banner): help should be findable, not loud. No 'use client'
 * — it is a plain `<Link>`, so it works in a Server Component page AND inside a client component.
 */
type GuideTarget =
  | { topic: GuideTopicId; recipe?: never; tab?: never }
  | { recipe: GuideRecipeId; topic?: never; tab?: never }
  | { tab: GuideTabId; topic?: never; recipe?: never };

function href(target: GuideTarget): string {
  if (target.topic) return `/guide?tab=features&topic=${target.topic}`;
  if (target.recipe) return `/guide?tab=howto&recipe=${target.recipe}`;
  return `/guide?tab=${target.tab}`;
}

export function GuideLink({
  label = 'Xem hướng dẫn',
  className,
  ...target
}: GuideTarget & {
  /** Say what the reader will find ("Cách nhập kho"), not just "help". */
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href(target)}
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 rounded-md text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className,
      )}
    >
      <BookOpenText className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  );
}
