import { redirect } from 'next/navigation';
import { HistoryTabs } from '@/components/history/history-tabs';
import { LiveRefresh } from '@/components/shell/live-refresh';
import { getSettings, listSentences } from '@/lib/practice';
import { listSharedFeed } from '@/lib/feed';
import { getOptionalSessionUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  // Resolve the full user (not just the id) — the community tab shows the viewer's own avatar on the
  // comment composer. Fail-closed like getSessionUserId: no session / banned ⇒ bounce to /login.
  const viewer = await getOptionalSessionUser();
  if (!viewer) redirect('/login');
  const [sentences, feed, settings] = await Promise.all([
    listSentences(viewer.id),
    listSharedFeed(viewer.id),
    getSettings(viewer.id),
  ]);

  return (
    <>
      <LiveRefresh />
      <HistoryTabs
        sentences={sentences}
        feed={feed}
        viewer={{ name: viewer.name, image: viewer.image }}
        voiceSpeaker={settings.voiceSpeaker}
        speechRate={settings.speechRate}
        furiganaMode={settings.furiganaMode}
        autoShareSentences={settings.autoShareSentences}
      />
    </>
  );
}
