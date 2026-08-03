import { HistoryView } from '@/components/history/history-view';
import { LiveRefresh } from '@/components/shell/live-refresh';
import { getSettings, listSentences } from '@/lib/practice';
import { getSessionUserId } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  // Auth gate: redirects to /login when there is no valid session.
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
