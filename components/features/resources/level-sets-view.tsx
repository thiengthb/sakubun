import Link from 'next/link';
import { PageShell } from '@/components/layout/page-shell';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { LeadPanel } from '@/components/common/lead-panel';
import { LIST_CARD } from '@/components/common/list-card';
import { ButtonLink } from '@/components/ui/button';
import {
  KIND_LABEL,
  leadActions,
  setAction,
  setSummary,
  type LevelAction,
  type LevelContext,
} from '@/lib/library/level-screen';
import type { LevelSet, LevelSets, SetWord, WordState } from '@/lib/library/level-sets';
import { cn } from '@/lib/core/utils';

// One JLPT level of one kind (U4c2, combined layout of docs/plans/2026-11-14-u4-kho.md): what to do
// next, the words forgotten most, then the level cut into sets of 20 with a mark per word.

// One mark per state, read with the summary line under it (the colour alone says nothing).
const MARK: Record<WordState, string> = {
  mastered: 'bg-ok',
  learning: 'bg-accent-brand/60',
  due: 'bg-warn',
  new: 'bg-muted-foreground/30',
  none: 'border border-dashed border-muted-foreground/50',
  paused: 'bg-muted',
};

export function levelTitle(ctx: Pick<LevelContext, 'level' | 'kind'>): string {
  return `${ctx.level} · ${KIND_LABEL[ctx.kind]}`;
}

export function levelMeta(sets: LevelSets): string {
  const total = sets.sets.reduce((n, s) => n + s.words.length, 0);
  const have = total - sets.counts.none;
  return `${sets.sets.length} chặng · ${have}/${total} trong kho · ${sets.mastered} đã thuộc`;
}

export function LevelSetsView({ sets, ctx }: { sets: LevelSets; ctx: LevelContext }) {
  const lead = leadActions(sets, ctx);
  return (
    <PageShell
      template="list"
      breadcrumb={<ParentCrumbs section="resources" self />}
      title={levelTitle(ctx)}
      meta={levelMeta(sets)}
    >
      <div className="flex flex-col gap-6">
        <LeadPanel aria-label="Bước tiếp theo" className="p-4 md:p-4">
          <p className="text-sm font-medium text-accent-brand">Bước tiếp theo</p>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-[1.4fr_1fr_1fr] md:gap-3">
            <ActionTile action={lead.main} primary className="col-span-2 md:col-span-1" />
            <ActionTile action={lead.due} />
            <ActionTile action={lead.take} />
          </div>
        </LeadPanel>

        {sets.forgotten.length > 0 && <Forgotten words={sets.forgotten} />}

        <section aria-labelledby="sets-heading">
          <h2 id="sets-heading" className="text-heading">
            Các chặng
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            20 mục mỗi chặng, theo thứ tự của Kho chung · mỗi ô là một mục
          </p>
          {sets.sets.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Kho chung chưa có mục nào ở cấp này.
            </p>
          ) : (
            <ol className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sets.sets.map((set) => (
                <SetCard key={set.number} set={set} ctx={ctx} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function ActionTile({
  action,
  primary = false,
  className,
}: {
  action: LevelAction;
  primary?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {action.count !== null && (
        <span className="text-title2 font-semibold tabular-nums">{action.count}</span>
      )}
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">{action.label}</span>
        <span
          className={cn(
            'text-xs',
            primary && action.href ? 'text-primary-foreground/85' : 'text-muted-foreground',
          )}
        >
          {action.hint}
        </span>
      </span>
    </>
  );
  const box =
    'flex min-h-14 items-center gap-3 rounded-lg px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
  if (!action.href)
    return <div className={cn(box, 'border border-border bg-card', className)}>{body}</div>;
  return (
    <Link
      href={action.href}
      className={cn(
        box,
        'transition-colors',
        primary
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border border-border bg-card hover:bg-muted',
        className,
      )}
    >
      {body}
    </Link>
  );
}

function Forgotten({ words }: { words: SetWord[] }) {
  return (
    <section aria-labelledby="forgotten-heading">
      <h2 id="forgotten-heading" className="text-heading">
        Hay quên nhất
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Mục bạn bấm Quên nhiều lần nhất</p>
      <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {words.map((w) => (
          <li key={w.entry.expression} className="w-32 shrink-0">
            <Link
              href={`/resources/${w.item!.id}`}
              className={cn(
                LIST_CARD.base,
                'flex h-full flex-col gap-0.5 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring',
              )}
            >
              <span lang="ja" className="truncate text-title3 font-semibold">
                {w.entry.expression}
              </span>
              {w.entry.reading && (
                <span lang="ja" className="truncate text-xs text-muted-foreground">
                  {w.entry.reading}
                </span>
              )}
              <span className="line-clamp-2 text-sm">{w.entry.meaningVi}</span>
              <span className="mt-auto pt-1 text-xs text-warn">quên {w.item!.lapses} lần</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SetCard({ set, ctx }: { set: LevelSet; ctx: LevelContext }) {
  const action = setAction(set, ctx);
  const first = set.words[0]!.entry.expression;
  const last = set.words.at(-1)!.entry.expression;
  return (
    <li
      id={`chang-${set.number}`}
      aria-labelledby={`chang-${set.number}-title`}
      className={cn(LIST_CARD.base, 'flex scroll-mt-20 flex-col gap-2 p-4')}
    >
      <div className="flex min-h-9 items-center gap-2">
        <h3 id={`chang-${set.number}-title`} className="font-semibold">
          Chặng {set.number}
        </h3>
        <span lang="ja" className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {first} → {last}
        </span>
        {action &&
          (action.href ? (
            <ButtonLink href={action.href} variant="outline">
              {action.label}
            </ButtonLink>
          ) : (
            <span className="rounded-full bg-ok-wash px-2 py-0.5 text-xs font-medium text-ok">
              {action.label}
            </span>
          ))}
      </div>
      <div className="grid grid-cols-10 gap-1" aria-hidden>
        {set.words.map((w) => (
          <span key={w.entry.expression} className={cn('h-2.5 rounded-sm', MARK[w.state])} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{setSummary(set.counts)}</p>
    </li>
  );
}
