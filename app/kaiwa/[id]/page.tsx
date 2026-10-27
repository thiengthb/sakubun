import { notFound } from 'next/navigation';
import { KaiwaScriptView } from '@/components/features/kaiwa/kaiwa-script-view';
import { getUserDb } from '@/lib/auth/current-user';
import { parseScript } from '@/lib/kaiwa/parse';
import { getScript } from '@/lib/kaiwa/scripts';
import { getSettings } from '@/lib/library/practice';
import { furiganaInApp } from '@/lib/settings/schema';

export const dynamic = 'force-dynamic';

export default async function KaiwaScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getUserDb();
  const [script, settings] = await Promise.all([getScript(db, id), getSettings(db)]);
  if (!script) notFound();
  return (
    <KaiwaScriptView
      script={{ id: script.id, title: script.title, updatedAt: script.updatedAt }}
      lines={parseScript(script.body)}
      voiceSpeaker={settings.voiceSpeaker}
      speechRate={settings.speechRate}
      showFurigana={furiganaInApp(settings.furiganaMode)}
    />
  );
}
