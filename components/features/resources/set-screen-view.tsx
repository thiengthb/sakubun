import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { Button, ButtonLink } from '@/components/ui/button';
import { setAction, STATE_LABEL, type LevelContext } from '@/lib/library/level-screen';
import { WORD_STATES, type LevelSet } from '@/lib/library/level-sets';
import { cellHref } from '@/lib/library/level-tally';
import { firstOpenWord, setHref, setMeta, setNeighbours, wordLink } from '@/lib/library/set-screen';
import { levelTitle } from './level-sets-view';
import { SetWordMap, type MapWord } from './set-word-map';
import { MARK } from './word-marks';
import { cn } from '@/lib/core/utils';

// One set of a level (U4c3, combined layout of docs/plans/2026-11-14-u4-kho.md,
// u4c-r2/combo-set.jpg): the sets before and after, the set's own button, a legend, then the map.

export function SetScreenView({
  set,
  total,
  ctx,
  tts,
}: {
  set: LevelSet;
  total: number;
  ctx: LevelContext;
  tts: { speaker: number; rate: number };
}) {
  const { prev, next } = setNeighbours(set.number, total);
  const action = setAction(set, ctx);
  const first = set.words[0]!.entry.expression;
  const last = set.words.at(-1)!.entry.expression;
  const words: MapWord[] = set.words.map((w) => ({
    ...w.entry,
    state: w.state,
    lapses: w.item?.lapses ?? 0,
    link: wordLink(w, ctx),
  }));
  return (
    <PageShell
      template="list"
      breadcrumb={
        <ParentCrumbs
          section="resources"
          self
          record={{ label: levelTitle(ctx), href: cellHref(ctx.level, ctx.kind) }}
        />
      }
      title={`Chặng ${set.number}`}
      meta={
        <>
          <span lang="ja">
            {first} → {last}
          </span>
          {` · ${setMeta(set, ctx)}`}
        </>
      }
      actionsOnPhone="split"
      actions={
        <>
          <Neighbour to={prev} ctx={ctx} side="prev" />
          <Neighbour to={next} ctx={ctx} side="next" />
          {action?.href && <ButtonLink href={action.href}>{action.label}</ButtonLink>}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ul aria-label="Chú thích màu" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {WORD_STATES.filter((s) => set.counts[s] > 0).map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span aria-hidden className={cn('size-3 rounded-xs', MARK[s])} />
              <span className="first-letter:uppercase">{STATE_LABEL[s]}</span>
              <span className="text-muted-foreground tabular-nums">{set.counts[s]}</span>
            </li>
          ))}
        </ul>
        <SetWordMap
          words={words}
          initial={firstOpenWord(set)}
          speaker={tts.speaker}
          rate={tts.rate}
        />
      </div>
    </PageShell>
  );
}

// The first set has none before it, the last none after: a greyed button keeps the row in place.
function Neighbour({
  to,
  ctx,
  side,
}: {
  to: number | null;
  ctx: LevelContext;
  side: 'prev' | 'next';
}) {
  const body =
    side === 'prev' ? (
      <>
        <ChevronLeft aria-hidden />
        Chặng trước
      </>
    ) : (
      <>
        Chặng sau
        <ChevronRight aria-hidden />
      </>
    );
  if (to === null)
    return (
      <Button variant="outline" disabled>
        {body}
      </Button>
    );
  return (
    <ButtonLink href={setHref(ctx, to)} variant="outline">
      {body}
    </ButtonLink>
  );
}
