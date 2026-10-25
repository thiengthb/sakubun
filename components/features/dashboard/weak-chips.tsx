'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Brain, RotateCcw, Tag, X, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/core/utils';
import { mergeWeakRows } from '@/lib/insights/weak-rows';

export interface WeakChip {
  key: string;
  text: string;
  count: string;
  /** The raw number behind `count`, for the merged table. */
  n: number;
  title: string;
  href?: string;
}

const KIND = {
  tags: { icon: Tag, label: 'Loại lỗi hay mắc', hint: '30 ngày qua', count: 'text-warn' },
  misses: { icon: X, label: 'Sai nhiều nhất', hint: '30 ngày qua', count: 'text-warn' },
  lapses: { icon: RotateCcw, label: 'Quên đi quên lại', hint: 'từ 4 lần', count: 'text-alert' },
  hard: {
    icon: Brain,
    label: 'Khó nhớ nhất',
    hint: 'độ khó FSRS /10',
    count: 'text-muted-foreground',
  },
} as const satisfies Record<
  string,
  { icon: LucideIcon; label: string; hint: string; count: string }
>;

export type WeakKind = keyof typeof KIND;

// A list shows this many; the rest open behind a "+N" chip, so a long month of misses does not
// push the heatmap a phone screen down.
const SHOWN = 6;
const CHIP = 'h-6 max-w-40 min-w-0 justify-start gap-1.5';

function Chip({ c, count }: { c: WeakChip; count: string }) {
  const body = (
    <>
      <span lang="ja" className="min-w-0 truncate">
        {c.text}
      </span>
      <span className={cn('shrink-0 tabular-nums', count)}>{c.count}</span>
    </>
  );
  return c.href ? (
    <Badge asChild variant="outline" className={CHIP}>
      <Link href={c.href} title={c.title}>
        {body}
      </Link>
    </Badge>
  ) : (
    <Badge variant="outline" title={c.title} className={CHIP}>
      {body}
    </Badge>
  );
}

function More({ hidden, label, onOpen }: { hidden: number; label: string; onOpen: () => void }) {
  return (
    <Badge asChild variant="outline" className={cn(CHIP, 'border-dashed')}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Xem thêm ${hidden} mục: ${label}`}
        className="text-muted-foreground tabular-nums"
      >
        +{hidden}
      </button>
    </Badge>
  );
}

type Groups = { kind: WeakKind; chips: WeakChip[] }[];

// The list keys whose "+N" was pressed, and how many of a list to show.
function useShown() {
  const [open, setOpen] = useState<string[]>([]);
  const shown = (key: string, n: number) => (open.includes(key) ? n : Math.min(n, SHOWN));
  const openKey = (key: string) => setOpen((o) => [...o, key]);
  return { shown, openKey };
}

// A wide card: the four lists, each under its name and what it counts.
function WeakSections({ groups, className }: { groups: Groups; className?: string }) {
  const { shown, openKey } = useShown();
  return (
    <div className={cn('@container', className)}>
      <div className="grid gap-x-6 gap-y-4 @lg:grid-cols-2">
        {groups.map(({ kind, chips }) => {
          const { icon: Icon, label, hint, count } = KIND[kind];
          const n = shown(kind, chips.length);
          return (
            <section key={kind} aria-label={label} className="min-w-0 space-y-2">
              <h4 className="flex items-center gap-1.5 text-xs">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="font-semibold">{label}</span>
                <span className="truncate text-muted-foreground">{hint}</span>
              </h4>
              {chips.length === 0 ? (
                <p className="text-xs text-muted-foreground">Không có</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {chips.slice(0, n).map((c) => (
                    <Chip key={c.key} c={c} count={count} />
                  ))}
                  {chips.length > n && (
                    <More hidden={chips.length - n} label={label} onOpen={() => openKey(kind)} />
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// A narrow card: the error kinds as chips, then one table of the patterns to work on with a column per
// reason, so a narrow screen reads one list instead of four.
function WeakTable({ groups, className }: { groups: Groups; className?: string }) {
  const { shown, openKey } = useShown();
  const tags = groups.find((g) => g.kind === 'tags')?.chips ?? [];
  const list = mergeWeakRows(
    groups.flatMap(({ kind, chips }) =>
      kind === 'tags' ? [] : [{ reason: kind, entries: chips }],
    ),
  );
  const n = shown('rows', list.length);
  const cell = 'w-12 shrink-0 text-right tabular-nums';
  return (
    <div className={cn('space-y-4', className)}>
      {tags.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground">Loại lỗi hay mắc</h4>
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, shown('tags', tags.length)).map((c) => (
              <Chip key={c.key} c={c} count={KIND.tags.count} />
            ))}
            {tags.length > shown('tags', tags.length) && (
              <More
                hidden={tags.length - SHOWN}
                label={KIND.tags.label}
                onOpen={() => openKey('tags')}
              />
            )}
          </div>
        </section>
      )}
      {list.length > 0 && (
        <section className="space-y-1">
          <div className="flex items-center gap-2 border-b border-border pb-1.5 text-xs font-semibold text-muted-foreground">
            <span className="min-w-0 flex-1">Mẫu cần ôn kỹ</span>
            <span className={cell}>Sai</span>
            <span className={cell}>Quên</span>
            <span className={cell}>Độ khó</span>
          </div>
          <ul>
            {list.slice(0, n).map((r) => (
              <li key={r.key} className="flex min-h-9 items-center gap-2 text-sm">
                {r.href ? (
                  <Link
                    href={r.href}
                    lang="ja"
                    className="min-w-0 flex-1 truncate rounded-sm hover:text-accent-brand focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {r.text}
                  </Link>
                ) : (
                  <span lang="ja" className="min-w-0 flex-1 truncate">
                    {r.text}
                  </span>
                )}
                <span className={cn(cell, r.misses ? 'text-warn' : 'text-muted-foreground')}>
                  {r.misses ?? '—'}
                </span>
                <span className={cn(cell, r.lapses ? 'text-alert' : 'text-muted-foreground')}>
                  {r.lapses ?? '—'}
                </span>
                <span className={cn(cell, 'text-muted-foreground')}>
                  {r.hard?.toFixed(1) ?? '—'}
                </span>
              </li>
            ))}
          </ul>
          {list.length > n && (
            <Button type="button" variant="ghost" size="sm" onClick={() => openKey('rows')}>
              Xem thêm {list.length - n} mẫu
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

// The 30-day weak spots: the sections when the card has room, the table when it is phone-narrow.
// thien, Phân tích round 2.
export function WeakChips({ groups, className }: { groups: Groups; className?: string }) {
  return (
    <div className={cn('@container', className)}>
      <WeakTable groups={groups} className="@sm:hidden" />
      <WeakSections groups={groups} className="@max-sm:hidden" />
    </div>
  );
}
