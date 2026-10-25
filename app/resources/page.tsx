import { LiveRefresh } from '@/components/layout/live-refresh';
import { ResourcesView } from '@/components/features/resources/resources-view';
import type { ResourceRow } from '@/components/features/resources/resource-table';
import { getSettings, listItems, VOCAB_KIND } from '@/lib/library/practice';
import { listGroups } from '@/lib/library/groups';
import { MAX_LISTED_ITEMS } from '@/lib/library/item-limits';
import { getSessionUserId } from '@/lib/auth/current-user';
import { furiganaInApp } from '@/lib/settings/schema';

export const dynamic = 'force-dynamic';

export default async function ResourcesPage() {
  await getSessionUserId();
  const [grammar, vocab, groups, settings] = await Promise.all([
    listItems({ limit: MAX_LISTED_ITEMS, withGroupIds: true }) as Promise<ResourceRow[]>,
    listItems({ kind: VOCAB_KIND, limit: MAX_LISTED_ITEMS, withGroupIds: true }) as Promise<ResourceRow[]>,
    listGroups(),
    getSettings(),
  ]);

  return (
    <>
      <LiveRefresh />
      <ResourcesView
        grammar={grammar}
        vocab={vocab}
        groups={groups}
        voiceSpeaker={settings.voiceSpeaker}
        speechRate={settings.speechRate}
        showFurigana={furiganaInApp(settings.furiganaMode)}
      />
    </>
  );
}
