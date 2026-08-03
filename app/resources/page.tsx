import { LiveRefresh } from '@/components/shell/live-refresh';
import { ResourcesView } from '@/components/resources/resources-view';
import type { ItemRow } from '@/components/resources/items-table';
import type { VocabRow } from '@/components/resources/vocab-table';
import { getSettings, listItems, VOCAB_KIND } from '@/lib/practice';
import { listGroups } from '@/lib/groups';
import { getSessionUserId } from '@/lib/current-user';
import { furiganaInApp } from '@/lib/settings-schema';

export const dynamic = 'force-dynamic';

// Per-user app — fetch the whole store and paginate/filter client-side (see the tables).
const MAX_ITEMS = 10_000;

export default async function ResourcesPage() {
  const userId = await getSessionUserId();
  const [grammar, vocab, groups, settings] = await Promise.all([
    listItems(userId, { limit: MAX_ITEMS }) as Promise<ItemRow[]>,
    listItems(userId, { kind: VOCAB_KIND, limit: MAX_ITEMS }) as Promise<VocabRow[]>,
    listGroups(userId),
    getSettings(userId),
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
