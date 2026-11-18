import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LiveRefresh } from '@/components/layout/live-refresh';
import { levelTitle } from '@/components/features/resources/level-sets-view';
import { SetScreenView } from '@/components/features/resources/set-screen-view';
import { getUserDb } from '@/lib/auth/current-user';
import { loadLevelSets } from '@/lib/app/level-sets';
import { JLPT_LEVELS } from '@/lib/kanji/data';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import type { LevelKind } from '@/lib/library/level-screen';
import type { BoardLevel } from '@/lib/library/level-tally';
import { getSettings } from '@/lib/library/practice';
import { ensureOpenJlptLibrary } from '@/lib/library/seed';
import { parseSetNumber } from '@/lib/library/set-screen';

export const dynamic = 'force-dynamic';

type Params = Promise<{ level: string; kind: string; set: string }>;

function parse(level: string, kind: string): { level: BoardLevel; kind: LevelKind } | null {
  if (!(JLPT_LEVELS as readonly string[]).includes(level)) return null;
  if (kind !== 'grammar' && kind !== 'vocab') return null;
  return { level: level as BoardLevel, kind };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { level, kind, set } = await params;
  const p = parse(level, kind);
  return { title: `${p ? `Chặng ${set} · ${levelTitle(p)}` : 'Kho'} — sakubun` };
}

// One set of a level (U4c3, docs/plans/2026-11-14-u4-kho.md), opened from a set card of the level
// screen. Sets are worked out on every visit (lib/library/level-sets.ts), so the whole level loads.
export default async function SetPage({ params }: { params: Params }) {
  const { level: rawLevel, kind: rawKind, set: rawSet } = await params;
  const p = parse(rawLevel, rawKind);
  if (!p) notFound();
  const db = await getUserDb();
  await ensureOpenJlptLibrary();
  const [sets, settings] = await Promise.all([
    loadLevelSets(db, p.level, p.kind === 'grammar' ? GRAMMAR_KIND : VOCAB_KIND),
    getSettings(db),
  ]);
  const number = parseSetNumber(rawSet, sets.sets.length);
  if (number === null) notFound();
  const studyLevel = p.kind === 'grammar' ? settings.grammarLevel : settings.vocabLevel;
  return (
    <>
      <LiveRefresh />
      <SetScreenView
        set={sets.sets[number - 1]!}
        total={sets.sets.length}
        ctx={{ ...p, studyLevel }}
        tts={{ speaker: settings.voiceSpeaker, rate: settings.speechRate }}
      />
    </>
  );
}
