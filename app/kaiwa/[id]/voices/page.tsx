import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { PageShell } from '@/components/layout/page-shell';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import {
  KaiwaVoicesForm,
  VOICES_NOTE,
  type VoicePart,
} from '@/components/features/kaiwa/kaiwa-voices-form';
import { getUserDb } from '@/lib/auth/current-user';
import { readAnalysis } from '@/lib/kaiwa/furigana';
import { scriptSpeakers } from '@/lib/kaiwa/layout';
import { parseScript, plainJapanese } from '@/lib/kaiwa/parse';
import { getScript } from '@/lib/kaiwa/scripts';
import { readVoices } from '@/lib/kaiwa/voices';
import { getSettings } from '@/lib/library/practice';
import { furiganaInApp } from '@/lib/settings/schema';

export const metadata: Metadata = { title: 'Giọng từng vai — sakubun' };
export const dynamic = 'force-dynamic';

// Kaiwa c: a voice per part of one script, on a page of its own (a form, docs/ui-standard.md).
export default async function KaiwaVoicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getUserDb();
  const [script, settings] = await Promise.all([getScript(db, id), getSettings(db)]);
  if (!script) notFound();
  const lines = parseScript(script.body);
  const analysis = readAnalysis(script.analysis, lines.length);
  const speakers = scriptSpeakers(lines);
  const parts: VoicePart[] = speakers.map((speaker) => {
    const i = lines.findIndex((line) => line.speaker === speaker);
    return {
      speaker,
      text: plainJapanese(lines[i].japanese),
      ruby: analysis?.lines[i].ruby ?? lines[i].japanese,
    };
  });

  return (
    <PageShell
      template="form"
      breadcrumb={
        <ParentCrumbs section="kaiwa" self record={{ label: script.title, href: `/kaiwa/${id}` }} />
      }
      title="Giọng từng vai"
      meta={<span>{VOICES_NOTE}</span>}
    >
      <Card>
        <CardContent>
          {parts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kịch bản này chưa có vai nào.</p>
          ) : (
            <KaiwaVoicesForm
              scriptId={id}
              parts={parts}
              settingsVoice={settings.voiceSpeaker}
              speechRate={settings.speechRate}
              showFurigana={furiganaInApp(settings.furiganaMode)}
              chosen={readVoices(script.voices, speakers)}
            />
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
