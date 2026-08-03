import { LiveRefresh } from '@/components/shell/live-refresh';
import { ResourcesView } from '@/components/resources/resources-view';
import type { ItemRow } from '@/components/resources/items-table';
import type { VocabRow } from '@/components/resources/vocab-table';
import { getSettings, listItems, VOCAB_KIND } from '@/lib/practice';
import { getSessionUserId } from '@/lib/current-user';
import { furiganaInApp } from '@/lib/settings-schema';

export const dynamic = 'force-dynamic';

// Per-user app — fetch the whole store and paginate/filter client-side (see the tables).
const MAX_ITEMS = 10_000;

export default async function ResourcesPage() {
  // Auth gate: redirects to /login when there is no valid session.
  await getSessionUserId();
  const [grammar, vocab, settings] = await Promise.all([
    listItems({ limit: MAX_ITEMS }) as Promise<ItemRow[]>,
    listItems({ kind: VOCAB_KIND, limit: MAX_ITEMS }) as Promise<VocabRow[]>,
    getSettings(),
  ]);

  return (
    <>
      <LiveRefresh />
      <ResourcesView
        grammar={grammar}
        vocab={vocab}
        voiceSpeaker={settings.voiceSpeaker}
        speechRate={settings.speechRate}
        showFurigana={furiganaInApp(settings.furiganaMode)}
      />
    </>
  );
}
