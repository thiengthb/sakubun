import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/core/utils';

type Tone = 'alert' | 'warn';

const TONE_CLASS: Record<Tone, string> = {
  alert: 'border-alert/40 text-alert hover:bg-alert/10',
  warn: 'border-warn/40 text-warn hover:bg-warn/10',
};

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
