import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
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
  STATE_LABEL,
  type LevelAction,
  type LevelContext,
} from '@/lib/library/level-screen';
import type { LevelSet, LevelSets, SetWord } from '@/lib/library/level-sets';
import { LEVEL_VIEWS, levelViewHref, levelWords, type LevelView } from '@/lib/library/level-views';
import { setHref } from '@/lib/library/set-screen';
import { cn } from '@/lib/core/utils';
import { LevelTabContent, LevelTabList, LevelTabs } from './level-tabs';
import { LevelWordMap } from './level-word-map';
import { MARK } from './word-marks';

// One JLPT level of one kind (U4c2, combined layout of docs/plans/2026-11-14-u4-kho.md): what to do
// next, the words forgotten most, then the level cut into sets of 20 with a mark per word. Tabs
// switch to a tile per word of the level (U4c4); only the open one is sent.

export function levelTitle(ctx: Pick<LevelContext, 'level' | 'kind'>): string {
  return `${ctx.level} · ${KIND_LABEL[ctx.kind]}`;
}

export function levelMeta(sets: LevelSets): string {
  const total = sets.sets.reduce((n, s) => n + s.words.length, 0);
  const have = total - sets.counts.none;
  return `${sets.sets.length} chặng · ${have}/${total} trong kho · ${sets.mastered} đã thuộc`;
}

export function LevelSetsView({
  sets,
  ctx,
  view,
  tts,
}: {
  sets: LevelSets;
  ctx: LevelContext;
  view: LevelView;
  tts: { speaker: number; rate: number };
}) {
  const hrefs = Object.fromEntries(LEVEL_VIEWS.map((v) => [v, levelViewHref(ctx, v)])) as Record<
    LevelView,
    string
  >;
  return (
    <LevelTabs view={view} hrefs={hrefs}>
      <PageShell
        template="list"
        breadcrumb={<ParentCrumbs section="resources" self />}
        title={levelTitle(ctx)}
        meta={levelMeta(sets)}
        tabs={<LevelTabList />}
      >
        <LevelTabContent
          value={view}
          className="transition-opacity group-aria-busy/tabs:opacity-60"
        >
          {view === 'sets' ? (
            <SetsView sets={sets} ctx={ctx} />
          ) : (
            <LevelWordMap words={levelWords(sets, ctx)} speaker={tts.speaker} rate={tts.rate} />
          )}
        </LevelTabContent>
      </PageShell>
    </LevelTabs>
  );
}

function SetsView({ sets, ctx }: { sets: LevelSets; ctx: LevelContext }) {
  const lead = leadActions(sets, ctx);
  return (
    <div className="flex flex-col gap-6">
      <LeadPanel aria-label="Bước tiếp theo" className="p-4 md:p-4">
        <p className="text-sm font-medium text-accent-brand">Bước tiếp theo</p>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-[1.4fr_1fr_1fr] md:gap-3">
          <ActionTile action={lead.main} tone="primary" className="col-span-2 md:col-span-1" />
          <ActionTile action={lead.due} tone="warn" />
          <ActionTile action={lead.take} tone="plain" />
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
          <p className="mt-3 text-sm text-muted-foreground">Kho chung chưa có mục nào ở cấp này.</p>
        ) : (
          <ol className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sets.sets.map((set) => (
              <SetCard key={set.number} set={set} ctx={ctx} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

// The number takes the tile's colour: white on the main tile, gold for what is due, grey for what
// is missing (the combined sketch, u4c-r2/combo-level.jpg). A tile with nothing to do is greyed out.
const NUMBER = {
  primary: '',
  warn: 'text-warn',
  plain: 'text-muted-foreground',
} as const;

function ActionTile({
  action,
  tone,
  className,
}: {
  action: LevelAction;
  tone: keyof typeof NUMBER;
  className?: string;
}) {
  const live = action.href !== null;
  const primary = tone === 'primary' && live;
  const body = (
    <>
      {action.count !== null && (
        <span
          className={cn(
            'min-w-7 shrink-0 text-center text-title3 font-semibold tabular-nums md:min-w-9 md:text-title2',
            live ? NUMBER[tone] : 'text-muted-foreground',
          )}
        >
          {action.count}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('font-semibold', !live && 'text-muted-foreground')}>
          {action.label}
        </span>
        <span
          className={cn(
            'text-xs md:truncate',
            primary ? 'text-primary-foreground/85' : 'text-muted-foreground',
          )}
        >
          {action.hint}
        </span>
      </span>
      {live && (
        <ChevronRight
          className={cn('size-4 shrink-0 opacity-60', !primary && 'max-md:hidden')}
          aria-hidden
        />
      )}
    </>
  );
  const box =
    'flex min-h-16 items-center gap-2 rounded-lg px-3 py-2 md:gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
  if (!live) return <div className={cn(box, 'border border-border/60', className)}>{body}</div>;
  return (
    <Link
      href={action.href!}
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
      className={cn(LIST_CARD.base, LIST_CARD.linked, 'flex scroll-mt-20 flex-col gap-2 p-4')}
    >
      {/* A full-size link under the card opens the set (LIST_CARD); the set's own button sits above
          it. Named by the title, so it reads "Chặng N". */}
      <Link
        href={setHref(ctx, set.number)}
        aria-labelledby={`chang-${set.number}-title`}
        className={LIST_CARD.link}
      />
      <div className="flex min-h-9 items-center gap-2">
        <h3 id={`chang-${set.number}-title`} className="font-semibold">
          Chặng {set.number}
        </h3>
        <span lang="ja" className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {first} → {last}
        </span>
        {action &&
          (action.href ? (
            <ButtonLink href={action.href} variant="outline" className="relative z-10">
              {action.label}
            </ButtonLink>
          ) : (
            <span className="relative rounded-full bg-ok-wash px-2 py-0.5 text-xs font-medium text-ok">
              {action.label}
            </span>
          ))}
      </div>
      {/* Each mark names its word and state for screen readers; the card's link lies over the marks,
          so the set screen (a tap away) is where each word shows with its meaning. */}
      <ul
        className="grid grid-cols-10 gap-1.5 max-w-64"
        aria-label={`Từng mục của chặng ${set.number}`}
      >
        {set.words.map((w) => {
          const name = `${w.entry.expression}: ${STATE_LABEL[w.state]}`;
          return (
            <li key={w.entry.expression} className={cn('aspect-square rounded-xs', MARK[w.state])}>
              <span className="sr-only">{name}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">{setSummary(set.counts)}</p>
    </li>
  );
}
