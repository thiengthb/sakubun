import { HistoryView } from '@/components/features/history/history-view';
import { LiveRefresh } from '@/components/layout/live-refresh';
import { listHistory } from '@/lib/app/history';
import { getSettings } from '@/lib/library/practice';
import { getUserDb } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const db = await getUserDb();
  const [sentences, settings] = await Promise.all([listHistory(db), getSettings(db)]);

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
