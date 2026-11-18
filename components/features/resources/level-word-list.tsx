'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/common/data-table';
import { SpokenLine } from '@/components/common/spoken-line';
import { Truncate } from '@/components/ui/truncate';
import type { WordState } from '@/lib/library/level-sets';
import { STATE_LABEL, type LevelContext } from '@/lib/library/level-screen';
import type { WordCard } from '@/lib/library/set-screen';
import { speakable } from '@/lib/core/format';
import { cn } from '@/lib/core/utils';
import { MARK } from './word-marks';

// The level screen's "Danh sách" (U4c4, docs/plans/2026-11-14-u4-kho.md): every word of the level
// in the sets' order, to look one up. The search box finds the word, its reading, Hán Việt or
// meaning; a row opens the learner's item, or the level in Kho chung when it is not taken yet.

// Sorting by state follows the legend: learnt first, missing last.
const STATE_ORDER: Record<WordState, number> = {
  mastered: 0,
  learning: 1,
  due: 2,
  new: 3,
  none: 4,
  paused: 5,
};

function State({ state }: { state: WordState }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn('size-3 shrink-0 rounded-xs', MARK[state])} />
      <span className="first-letter:uppercase">{STATE_LABEL[state]}</span>
    </span>
  );
}

interface Voice {
  speaker?: number;
  rate?: number;
}

function Expression({ word, voice, big }: { word: WordCard; voice: Voice; big?: boolean }) {
  return (
    <SpokenLine
      text={word.expression}
      speakText={speakable(word.expression)}
      speaker={voice.speaker}
      rate={voice.rate}
      truncate
      className={cn('font-semibold', big && 'text-title3')}
    />
  );
}

function columns(kind: LevelContext['kind'], voice: Voice): ColumnDef<WordCard, unknown>[] {
  const head = kind === 'grammar' ? 'Mẫu' : 'Từ';
  return [
    {
      accessorKey: 'expression',
      header: head,
      size: 180,
      minSize: 100,
      enableHiding: false,
      meta: { label: head },
      cell: ({ row }) => <Expression word={row.original} voice={voice} />,
    },
    {
      accessorFn: (w) => w.reading ?? '',
      id: 'reading',
      header: 'Cách đọc',
      size: 150,
      minSize: 90,
      meta: { label: 'Cách đọc' },
      cell: ({ row }) => (
        <span lang="ja" className="text-muted-foreground">
          {row.original.reading}
        </span>
      ),
    },
    {
      accessorFn: (w) => w.hanviet ?? '',
      id: 'hanviet',
      header: 'Hán Việt',
      size: 130,
      minSize: 90,
      meta: { label: 'Hán Việt', defaultHidden: kind === 'grammar' },
      cell: ({ row }) => row.original.hanviet?.toUpperCase(),
    },
    {
      accessorFn: (w) => w.meaningVi ?? '',
      id: 'meaning',
      header: 'Nghĩa',
      size: 280,
      minSize: 120,
      meta: { label: 'Nghĩa' },
      cell: ({ row }) => <Truncate>{row.original.meaningVi}</Truncate>,
    },
    {
      id: 'state',
      accessorFn: (w) => STATE_ORDER[w.state],
      header: 'Trạng thái',
      size: 130,
      minSize: 100,
      enableGlobalFilter: false,
      meta: { label: 'Trạng thái', cellClassName: 'whitespace-nowrap' },
      cell: ({ row }) => <State state={row.original.state} />,
    },
    {
      id: 'set',
      accessorFn: (w) => w.set.number,
      header: 'Chặng',
      size: 110,
      minSize: 70,
      enableGlobalFilter: false,
      meta: { label: 'Chặng', cellClassName: 'whitespace-nowrap' },
      cell: ({ row }) => (
        <Link href={row.original.set.href} className="tabular-nums hover:underline">
          Chặng {row.original.set.number}
        </Link>
      ),
    },
    {
      id: 'open',
      header: 'Mở',
      size: 150,
      minSize: 110,
      enableSorting: false,
      enableGlobalFilter: false,
      meta: { label: 'Mở', cellClassName: 'whitespace-nowrap' },
      cell: ({ row }) => (
        <Link href={row.original.link.href} className="text-accent-brand hover:underline">
          {row.original.link.label}
        </Link>
      ),
    },
  ];
}

export function LevelWordList({
  words,
  ctx,
  speaker,
  rate,
}: {
  words: WordCard[];
  ctx: LevelContext;
  speaker?: number;
  rate?: number;
}) {
  const cols = useMemo(() => columns(ctx.kind, { speaker, rate }), [ctx.kind, speaker, rate]);
  return (
    <DataTable
      columns={cols}
      data={words}
      getRowId={(w) => w.expression}
      persistKey={`level.${ctx.level}.${ctx.kind}`}
      urlPrefix="l."
      searchPlaceholder={`Tìm trong ${ctx.level}: chữ, cách đọc, nghĩa…`}
      countNoun={ctx.kind === 'grammar' ? 'mẫu' : 'từ'}
      totalCount={words.length}
      emptyMessage="Không có mục nào khớp tìm kiếm."
      enableRowNumbers
      cardHref={(w) => w.link.href}
      cardHrefLabel={(w) => `${w.expression}: ${w.link.label}`}
      renderCard={(w) => (
        <div className="flex flex-col gap-1">
          <div className="flex min-w-0 items-baseline gap-2">
            {/* Above the card's link, so the speaker plays instead of opening the item. */}
            <div className="relative z-10 min-w-0">
              <Expression word={w} voice={{ speaker, rate }} big />
            </div>
            {(w.reading || w.hanviet) && (
              <span className="min-w-0 truncate text-sm text-muted-foreground">
                {w.reading && <span lang="ja">{w.reading}</span>}
                {w.reading && w.hanviet && ' · '}
                {w.hanviet?.toUpperCase()}
              </span>
            )}
          </div>
          {w.meaningVi && <p className="line-clamp-2 text-sm">{w.meaningVi}</p>}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <State state={w.state} />
            <span>Chặng {w.set.number}</span>
          </div>
        </div>
      )}
    />
  );
}
