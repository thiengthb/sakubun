import { HistoryView } from '@/components/history/history-view';
import { LiveRefresh } from '@/components/shell/live-refresh';
import { getSettings, listSentences } from '@/lib/practice';
import { getSessionUserId } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const userId = await getSessionUserId();
  const [sentences, settings] = await Promise.all([listSentences(userId), getSettings(userId)]);

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
