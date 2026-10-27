import { notFound } from 'next/navigation';
import { KaiwaScriptView } from '@/components/features/kaiwa/kaiwa-script-view';
import { getUserDb } from '@/lib/auth/current-user';
import { readAnalysis } from '@/lib/kaiwa/furigana';
import { lookupWords } from '@/lib/kaiwa/lookup';
import { parseScript } from '@/lib/kaiwa/parse';
import { getScript } from '@/lib/kaiwa/scripts';
import { groupKeys, wordGroups } from '@/lib/kaiwa/words';
import { getSettings } from '@/lib/library/practice';
import { furiganaInApp } from '@/lib/settings/schema';

export const dynamic = 'force-dynamic';

export default async function KaiwaScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getUserDb();
  const [script, settings] = await Promise.all([getScript(db, id), getSettings(db)]);
  if (!script) notFound();
  const lines = parseScript(script.body);
  const analysis = readAnalysis(script.analysis, lines.length);

  // Each line's words with what they are looked up by (K5); the meanings come in one query.
  const grouped = lines.map((_, i) => {
    const line = analysis?.lines[i];
    const groups = line ? wordGroups(line.ruby, line.tokens) : null;
    return groups?.map((g) => ({ length: g.length, keys: groupKeys(g, line!.tokens) }));
  });
  const meanings = await lookupWords(db, [
    ...new Set(grouped.flatMap((groups) => groups?.flatMap((g) => g.keys) ?? [])),
  ]);
  const known = (keys: string[]) => keys.find((k) => k in meanings) ?? null;
  const used = new Set(grouped.flatMap((gs) => gs?.map((g) => known(g.keys)) ?? []));

  return (
    <KaiwaScriptView
      script={{ id: script.id, title: script.title, updatedAt: script.updatedAt }}
      lines={lines.map((line, i) => ({
        ...line,
        ruby: analysis?.lines[i].ruby ?? line.japanese,
        words: grouped[i]?.map((g) => ({ length: g.length, key: known(g.keys) })) ?? null,
      }))}
      meanings={Object.fromEntries(Object.entries(meanings).filter(([k]) => used.has(k)))}
      voiceSpeaker={settings.voiceSpeaker}
      speechRate={settings.speechRate}
      showFurigana={furiganaInApp(settings.furiganaMode)}
    />
  );
}
