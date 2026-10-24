import Link from 'next/link';
import { Brain, RotateCcw, Tag, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/core/utils';

export interface WeakChip {
  key: string;
  text: string;
  count: string;
  title: string;
  href?: string;
}

const KIND = {
  tags: { icon: Tag, label: 'Loại lỗi hay mắc', count: 'text-warn' },
  misses: { icon: X, label: 'Sai nhiều nhất', count: 'text-warn' },
  lapses: { icon: RotateCcw, label: 'Quên đi quên lại', count: 'text-alert' },
  hard: { icon: Brain, label: 'Tốn sức nhớ nhất', count: 'text-muted-foreground' },
} as const satisfies Record<string, { icon: LucideIcon; label: string; count: string }>;

export type WeakKind = keyof typeof KIND;

// The 30-day weak spots as chips, grouped by kind. Each group is led by an icon whose name is its
// tooltip, so the four lists read as one strip instead of four labelled blocks.
export function WeakChips({
  groups,
  className,
}: {
  groups: { kind: WeakKind; chips: WeakChip[] }[];
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {groups
        .filter((g) => g.chips.length > 0)
        .map(({ kind, chips }) => {
          const { icon: Icon, label, count } = KIND[kind];
          return (
            <div
              key={kind}
              role="group"
              aria-label={label}
              className="flex flex-wrap items-center gap-1.5"
            >
              <span
                title={label}
                className="flex size-6 shrink-0 items-center justify-center text-muted-foreground"
              >
                <Icon className="size-4" aria-hidden />
              </span>
              {chips.map((c) => {
                const body = (
                  <>
                    <span lang="ja" className="min-w-0 truncate">
                      {c.text}
                    </span>
                    <span className={cn('shrink-0 font-medium tabular-nums', count)}>
                      {c.count}
                    </span>
                  </>
                );
                const chipClass =
                  'inline-flex h-7 max-w-40 min-w-0 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs';
                return c.href ? (
                  <Link
                    key={c.key}
                    href={c.href}
                    title={c.title}
                    className={cn(
                      chipClass,
                      'transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                    )}
                  >
                    {body}
                  </Link>
                ) : (
                  <span key={c.key} title={c.title} className={chipClass}>
                    {body}
                  </span>
                );
              })}
            </div>
          );
        })}
    </div>
  );
}
