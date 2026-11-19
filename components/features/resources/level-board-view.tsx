'use client';

import Link from 'next/link';
import { ChevronRight, List } from 'lucide-react';
import { AddSheet } from '@/components/features/resources/add-sheet';
import { PageShell } from '@/components/layout/page-shell';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { LIST_CARD } from '@/components/common/list-card';
import {
  cellHref,
  cellNote,
  studyLabels,
  type BoardKind,
  type LevelCell,
  type LevelRow,
} from '@/lib/library/level-tally';
import type { KhoBoard } from '@/lib/app/level-board';
import type { KhoSearch } from '@/lib/app/kho-search';
import { KhoSearchBox, KhoSearchResults, type Voice } from './kho-search';
import { cn } from '@/lib/core/utils';
import { KHO_BOARD_META } from './kho-copy';

const KINDS: { kind: BoardKind; label: string }[] = [
  { kind: 'grammar', label: 'Ngữ pháp' },
  { kind: 'vocab', label: 'Từ vựng' },
  { kind: 'kanji', label: 'Kanji' },
];

// Kho opens on the JLPT levels (U4b, direction 2 of docs/plans/2026-11-14-u4-kho.md): a card per
// level, a cell per kind with how much of the whole level the learner has and has mastered, then
// what lies outside JLPT. A cell opens the level in Kho chung until U4c gives each level its list.
export function LevelBoardView({
  board,
  grammarLevel,
  vocabLevel,
  search,
  voice,
}: {
  board: KhoBoard;
  grammarLevel: string;
  vocabLevel: string;
  /** The answer to ?q= (U4f): while there is one, it takes the board's place. */
  search: KhoSearch | null;
  voice: Voice;
}) {
  const labels = studyLabels(grammarLevel, vocabLevel);
  return (
    <PageShell
      template="list"
      title="Kho"
      meta={KHO_BOARD_META}
      actions={
        <>
          {/* On a phone it would squeeze the title; the Ngoài JLPT card links there too. */}
          <ExpandingIconButton
            href="/resources/all"
            icon={List}
            label="Mọi mục"
            className="max-md:hidden"
          />
          <AddSheet />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <KhoSearchBox query={search?.query ?? ''} />
        {search ? (
          <KhoSearchResults search={search} voice={voice} />
        ) : (
          <div className="flex flex-col gap-3">
            {board.levels.map((row) => (
              <LevelCard key={row.level} row={row} labels={labels} />
            ))}
            <OutsideCard outside={board.outside} groups={board.groups} />
          </div>
        )}
      </div>
    </PageShell>
  );
}

function LevelCard({ row, labels }: { row: LevelRow; labels: ReturnType<typeof studyLabels> }) {
  return (
    <section aria-labelledby={`level-${row.level}`} className={cn(LIST_CARD.base, 'p-4')}>
      <h2 id={`level-${row.level}`} className="flex items-baseline gap-2 text-heading">
        {row.level}
        {labels.level === row.level && <StudyLabel />}
      </h2>
      <div className="mt-2 grid gap-1 md:grid-cols-3 md:gap-4">
        {KINDS.map(({ kind, label }) => (
          <Cell
            key={kind}
            level={row.level}
            kind={kind}
            label={label}
            cell={row[kind]}
            studying={
              (kind === 'grammar' && labels.grammar === row.level) ||
              (kind === 'vocab' && labels.vocab === row.level)
            }
          />
        ))}
      </div>
    </section>
  );
}

function StudyLabel() {
  return <span className="text-xs font-medium text-accent-brand">đang học</span>;
}

function Cell({
  level,
  kind,
  label,
  cell,
  studying,
}: {
  level: LevelRow['level'];
  kind: BoardKind;
  label: string;
  cell: LevelCell;
  studying: boolean;
}) {
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-2 text-sm">
        <span className="flex items-baseline gap-2 font-medium">
          {label}
          {studying && <StudyLabel />}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {cell.have}/{cell.total}
        </span>
      </span>
      <Bar cell={cell} label={`${level} · ${label}`} />
      <span className="text-xs text-muted-foreground">{cellNote(cell)}</span>
    </>
  );
  const box = 'flex min-h-11 flex-col gap-1.5 rounded-lg px-2 py-2 -mx-2';
  if (cell.total === 0) return <div className={box}>{body}</div>;
  return (
    <Link
      href={cellHref(level, kind)}
      className={cn(
        box,
        'transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring',
      )}
    >
      {body}
    </Link>
  );
}

// Mastered first, then the rest of what the learner has; the empty track is what is not taken yet.
function Bar({ cell, label }: { cell: LevelCell; label: string }) {
  const part = (n: number) => `${cell.total > 0 ? (100 * n) / cell.total : 0}%`;
  return (
    <span
      role="progressbar"
      aria-label={`Đã có trong kho: ${label}, ${cell.mastered} đã thuộc`}
      aria-valuemin={0}
      aria-valuemax={cell.total}
      aria-valuenow={cell.have}
      className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <span className="bg-ok" style={{ width: part(cell.mastered) }} />
      <span className="bg-accent-brand/50" style={{ width: part(cell.have - cell.mastered) }} />
    </span>
  );
}

function OutsideCard({ outside, groups }: { outside: number; groups: number }) {
  return (
    <section aria-labelledby="level-outside" className={cn(LIST_CARD.base, 'p-4')}>
      <h2 id="level-outside" className="text-heading">
        Ngoài JLPT
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Mục bạn tự thêm, nhờ Claude soạn hoặc lấy từ bộ người khác chia sẻ, và Nhóm của bạn.
      </p>
      <div className="mt-2 grid gap-1 md:grid-cols-3 md:gap-4">
        <OutsideLink href="/resources/outside" label="Mục ngoài JLPT" count={outside} />
        <OutsideLink href="/resources/all?tab=groups" label="Nhóm của bạn" count={groups} />
        <OutsideLink href="/resources/all" label="Mọi mục của bạn" />
      </div>
    </section>
  );
}

function OutsideLink({ href, label, count }: { href?: string; label: string; count?: number }) {
  const row = '-mx-2 flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm';
  const body = (
    <>
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-1 text-muted-foreground tabular-nums">
        {count}
        {href && <ChevronRight className="size-4" aria-hidden />}
      </span>
    </>
  );
  if (!href) return <div className={row}>{body}</div>;
  return (
    <Link
      href={href}
      className={cn(
        row,
        'transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring',
      )}
    >
      {body}
    </Link>
  );
}
