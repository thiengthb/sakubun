import { notFound } from 'next/navigation';
import { KaiwaCanvas } from '@/components/features/kaiwa/kaiwa-canvas';
import { getUserDb } from '@/lib/auth/current-user';
import { readAnalysis } from '@/lib/kaiwa/furigana';
import { parseScript } from '@/lib/kaiwa/parse';
import { getScript } from '@/lib/kaiwa/scripts';
import { getSettings } from '@/lib/library/practice';
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
  const [script, settings] = await Promise.all([getScript(db, id), getSettings(db)]);
  if (!script) notFound();
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
      startEditing={edit === '1'}
      voiceSpeaker={settings.voiceSpeaker}
      speechRate={settings.speechRate}
      showFurigana={furiganaInApp(settings.furiganaMode)}
    />
  );
}
