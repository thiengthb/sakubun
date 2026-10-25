'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Brain, RotateCcw, Tag, X, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

// A group shows this many chips; the rest open behind a "+N" chip, so a long month of misses
// does not push the heatmap a phone screen down.
const SHOWN = 6;

// The 30-day weak spots as chips, grouped by kind. Each group is led by an icon whose name is its
// tooltip, so the four lists read as one strip instead of four labelled blocks.
export function WeakChips({
  groups,
  className,
}: {
  groups: { kind: WeakKind; chips: WeakChip[] }[];
  className?: string;
}) {
  const [open, setOpen] = useState<WeakKind[]>([]);
  return (
    <div className={cn('space-y-2', className)}>
      {groups
        .filter((g) => g.chips.length > 0)
        .map(({ kind, chips }) => {
          const { icon: Icon, label, count } = KIND[kind];
          const hidden = open.includes(kind) ? 0 : Math.max(0, chips.length - SHOWN);
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
              {chips.slice(0, chips.length - hidden).map((c) => {
                const body = (
                  <>
                    <span lang="ja" className="min-w-0 truncate">
                      {c.text}
                    </span>
                    <span className={cn('shrink-0 tabular-nums', count)}>{c.count}</span>
                  </>
                );
                return c.href ? (
                  <Badge key={c.key} asChild variant="outline" className={CHIP}>
                    <Link href={c.href} title={c.title}>
                      {body}
                    </Link>
                  </Badge>
                ) : (
                  <Badge key={c.key} variant="outline" title={c.title} className={CHIP}>
                    {body}
                  </Badge>
                );
              })}
              {hidden > 0 && (
                <Badge asChild variant="outline" className={cn(CHIP, 'border-dashed')}>
                  <button
                    type="button"
                    onClick={() => setOpen((o) => [...o, kind])}
                    aria-label={`Xem thêm ${hidden} mục: ${label}`}
                    className="text-muted-foreground tabular-nums"
                  >
                    +{hidden}
                  </button>
                </Badge>
              )}
            </div>
          );
        })}
    </div>
  );
}

const CHIP = 'h-6 max-w-40 min-w-0 justify-start gap-1.5';
