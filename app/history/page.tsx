import { HistoryView } from '@/components/features/history/history-view';
import { LiveRefresh } from '@/components/layout/live-refresh';
import { getSettings, listSentences } from '@/lib/library/practice';
import { getSessionUserId } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  await getSessionUserId();
  const [sentences, settings] = await Promise.all([listSentences(), getSettings()]);

  return (
    <>
      <LiveRefresh />
      <HistoryView
        sentences={sentences}
        voiceSpeaker={settings.voiceSpeaker}
        speechRate={settings.speechRate}
        furiganaMode={settings.furiganaMode}
      />
    </>
  );
}
