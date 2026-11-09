import { HistoryView } from '@/components/features/history/history-view';
import { LiveRefresh } from '@/components/layout/live-refresh';
import { listHistory } from '@/lib/app/history';
import { listRoleplays } from '@/lib/kaiwa/roleplays';
import { getSettings } from '@/lib/library/practice';
import { getUserDb } from '@/lib/auth/current-user';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const db = await getUserDb();
  const [sentences, roleplays, settings] = await Promise.all([
    listHistory(db),
    listRoleplays(db),
    getSettings(db),
  ]);

  return (
    <>
      <LiveRefresh />
      <HistoryView
        sentences={sentences}
        roleplays={roleplays}
        voiceSpeaker={settings.voiceSpeaker}
        speechRate={settings.speechRate}
        furiganaMode={settings.furiganaMode}
      />
    </>
  );
}
