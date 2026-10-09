import { LiveRefresh } from '@/components/shell/live-refresh';
import { ResourcesView } from '@/components/resources/resources-view';
import type { ItemRow } from '@/components/resources/items-table';
import type { VocabRow } from '@/components/resources/vocab-table';
import { getSettings, listItems, VOCAB_KIND } from '@/lib/practice';
import { listGroups } from '@/lib/groups';
import { getSessionUserId } from '@/lib/current-user';
import { furiganaInApp } from '@/lib/settings-schema';

export const dynamic = 'force-dynamic';

const MAX_ITEMS = 10_000;

export default async function ResourcesPage() {
  await getSessionUserId();
  const [grammar, vocab, groups, settings] = await Promise.all([
    listItems({ limit: MAX_ITEMS, withGroupIds: true }) as Promise<ItemRow[]>,
    listItems({ kind: VOCAB_KIND, limit: MAX_ITEMS, withGroupIds: true }) as Promise<VocabRow[]>,
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
