import { notFound } from 'next/navigation';
import { KaiwaCanvas } from '@/components/features/kaiwa/kaiwa-canvas';
import { KaiwaSideList } from '@/components/features/kaiwa/kaiwa-side-list';
import { getUserDb } from '@/lib/auth/current-user';
import { readAnalysis } from '@/lib/kaiwa/furigana';
import { parseScript } from '@/lib/kaiwa/parse';
import { getScript, listScriptCards } from '@/lib/kaiwa/scripts';
import { getSettings } from '@/lib/library/practice';
import { scriptLibraryMarks, scriptShareStatus } from '@/lib/library/scripts';
import { furiganaInApp } from '@/lib/settings/schema';

export const dynamic = 'force-dynamic';

export default async function KaiwaScriptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ id }, { edit }] = await Promise.all([params, searchParams]);
  const db = await getUserDb();
  const [script, settings, share, cards, marks] = await Promise.all([
    getScript(db, id),
    getSettings(db),
    scriptShareStatus(db, id),
    listScriptCards(db),
    scriptLibraryMarks(db),
  ]);
  if (!script || !share) notFound();
  const lines = parseScript(script.body);
  const analysis = readAnalysis(script.analysis, lines.length);

  // The words are looked up as on every other sentence (7.4b), so the page sends only the readings.
  return (
    <KaiwaCanvas
      script={{
        id: script.id,
        version: script.version,
        title: script.title,
        body: script.body,
        updatedAt: script.updatedAt,
        lines: lines.map((line, i) => ({
          ...line,
          ruby: analysis?.lines[i].ruby ?? line.japanese,
        })),
      }}
      share={share}
      startEditing={edit === '1'}
      voiceSpeaker={settings.voiceSpeaker}
      speechRate={settings.speechRate}
      showFurigana={furiganaInApp(settings.furiganaMode)}
      aside={
        <KaiwaSideList
          currentId={script.id}
          scripts={cards.map((s) => ({
            ...s,
            sharedEntryId: marks.get(s.id)?.sharedEntryId ?? null,
            taken: marks.get(s.id)?.taken ?? false,
          }))}
        />
      }
    />
  );
}
