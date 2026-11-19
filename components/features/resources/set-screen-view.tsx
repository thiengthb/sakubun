import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { KhoTrail } from '@/components/layout/kho-trail';
import { Button, ButtonLink, buttonVariants } from '@/components/ui/button';
import { setAction, STATE_LABEL, type LevelContext } from '@/lib/library/level-screen';
import { WORD_STATES, type LevelSet } from '@/lib/library/level-sets';
import { firstOpenWord, setHref, setMeta, setNeighbours, wordCard } from '@/lib/library/set-screen';
import { WordMap } from './word-map';
import { MARK } from './word-marks';
import { TakeLevelTrigger } from './take-buttons';
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
  const words = set.words.map((w) => wordCard(w, set.number, ctx));
  return (
    <PageShell
      template="list"
      breadcrumb={<KhoTrail place={{ way: 'levels', level: ctx.level, kind: ctx.kind }} />}
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
          {action?.take ? (
            <TakeLevelTrigger ctx={ctx} scope={action.take} className={buttonVariants()}>
              {action.label}
            </TakeLevelTrigger>
          ) : (
            action?.href && <ButtonLink href={action.href}>{action.label}</ButtonLink>
          )}
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
        <WordMap
          sections={[{ key: `chang-${set.number}`, label: `Chặng ${set.number}`, words }]}
          initial={words[firstOpenWord(words)]!.expression}
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
        Trước
      </>
    ) : (
      <>
        Sau
        <ChevronRight aria-hidden />
      </>
    );
  // The screen is a set, so "Trước" and "Sau" say enough (thien, KN1 review); a screen reader
  // still hears which way.
  const label = side === 'prev' ? 'Chặng trước' : 'Chặng sau';
  if (to === null)
    return (
      <Button variant="outline" disabled aria-label={label}>
        {body}
      </Button>
    );
  return (
    <ButtonLink href={setHref(ctx, to)} variant="outline" aria-label={label}>
      {body}
    </ButtonLink>
  );
}
