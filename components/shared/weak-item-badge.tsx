import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Tone = 'alert' | 'warn';

const TONE_CLASS: Record<Tone, string> = {
  alert: 'border-alert/40 text-alert hover:bg-alert/10',
  warn: 'border-warn/40 text-warn hover:bg-warn/10',
};

/**
 * One weak pattern on the dashboard, linking to its detail page. Shared by every weakness list
 * (leeches, most-missed, high-difficulty watchlist) so the three read as one idea and gain the same
 * behaviour at once — they used to be inert badges, so a learner could see WHAT was weak and had no
 * way to act on it.
 */
export function WeakItemBadge({
  itemId,
  expression,
  detail,
  tone = 'warn',
}: {
  itemId: string;
  expression: string;
  detail: string;
  tone?: Tone;
}) {
  return (
    <Link
      href={`/resources/${itemId}`}
      className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Badge
        variant="outline"
        className={cn('transition-colors motion-reduce:transition-none', TONE_CLASS[tone])}
      >
        <span lang="ja">{expression}</span>
        <span className="ml-1 text-xs opacity-80">{detail}</span>
      </Badge>
    </Link>
  );
}
