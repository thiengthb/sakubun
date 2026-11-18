import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LiveRefresh } from '@/components/layout/live-refresh';
import { LevelSetsView, levelTitle } from '@/components/features/resources/level-sets-view';
import { getUserDb } from '@/lib/auth/current-user';
import { loadLevelSets } from '@/lib/app/level-sets';
import { JLPT_LEVELS } from '@/lib/kanji/data';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import type { LevelKind } from '@/lib/library/level-screen';
import type { BoardLevel } from '@/lib/library/level-tally';
import { parseLevelView } from '@/lib/library/level-views';
import { getSettings } from '@/lib/library/practice';
import { ensureOpenJlptLibrary } from '@/lib/library/seed';

export const dynamic = 'force-dynamic';

type Params = Promise<{ level: string; kind: string }>;

function parse(level: string, kind: string): { level: BoardLevel; kind: LevelKind } | null {
  if (!(JLPT_LEVELS as readonly string[]).includes(level)) return null;
  if (kind !== 'grammar' && kind !== 'vocab') return null;
  return { level: level as BoardLevel, kind };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { level, kind } = await params;
  const p = parse(level, kind);
  return { title: `${p ? levelTitle(p) : 'Kho'} — sakubun` };
}

// One level of one kind (U4c2, docs/plans/2026-11-14-u4-kho.md), opened from a cell of Kho's
// level board: what to do next, the words forgotten most, and the level cut into sets of 20; or,
// by ?view= (U4c4), a tile per word of the level.
export default async function LevelPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ level: rawLevel, kind: rawKind }, query] = await Promise.all([params, searchParams]);
  const p = parse(rawLevel, rawKind);
  if (!p) notFound();
  const db = await getUserDb();
  await ensureOpenJlptLibrary();
  const [sets, settings] = await Promise.all([
    loadLevelSets(db, p.level, p.kind === 'grammar' ? GRAMMAR_KIND : VOCAB_KIND),
    getSettings(db),
  ]);
  const studyLevel = p.kind === 'grammar' ? settings.grammarLevel : settings.vocabLevel;
  return (
    <>
      <LiveRefresh />
      <LevelSetsView
        sets={sets}
        ctx={{ ...p, studyLevel }}
        view={parseLevelView(query.view)}
        tts={{ speaker: settings.voiceSpeaker, rate: settings.speechRate }}
      />
    </>
  );
}
