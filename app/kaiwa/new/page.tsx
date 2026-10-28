import type { Metadata } from 'next';
import { KaiwaCanvas } from '@/components/features/kaiwa/kaiwa-canvas';
import { getUserDb } from '@/lib/auth/current-user';
import { getSettings } from '@/lib/library/practice';
import { furiganaInApp } from '@/lib/settings/schema';

export const metadata: Metadata = { title: 'Thêm kịch bản — sakubun' };
export const dynamic = 'force-dynamic';

// A new script opens the canvas straight in its editor, with nothing written yet (7.4f).
export default async function NewScriptPage() {
  const settings = await getSettings(await getUserDb());
  return (
    <KaiwaCanvas
      startEditing
      voiceSpeaker={settings.voiceSpeaker}
      speechRate={settings.speechRate}
      showFurigana={furiganaInApp(settings.furiganaMode)}
    />
  );
}
