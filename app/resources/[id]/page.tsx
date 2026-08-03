import { notFound } from 'next/navigation';
import { LiveRefresh } from '@/components/shell/live-refresh';
import { ItemAnalytics } from '@/components/resources/item-analytics';
import { ItemGroups } from '@/components/resources/item-groups';
import { ShareToggle } from '@/components/resources/share-toggle';
import { getItemStats } from '@/lib/item-stats';
import { getItemGroupPicker } from '@/lib/groups';
import { getItemVisibility } from '@/lib/library';
import { getSettings } from '@/lib/practice';
import { getSessionUserId } from '@/lib/current-user';
import { furiganaInApp } from '@/lib/settings-schema';

export const dynamic = 'force-dynamic';

// Per-item analytics page ("card info", Anki-style) — reached from the ⋮ menu of either resources
// table. `id` is the Item cuid; works for both grammar and vocab (both carry FSRS state + a log).
export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  const [stats, picker, visibility, settings] = await Promise.all([
    getItemStats(userId, id),
    getItemGroupPicker(userId, id),
    getItemVisibility(userId, id),
    getSettings(userId),
  ]);
  if (!stats) notFound();

  return (
    // No wrapper padding here: ItemAnalytics renders its own PageShell (which owns the py-6 rhythm) —
    // an outer py-8 double-padded the page top/bottom (layout std invariant #8).
    <>
      <LiveRefresh />
      <ItemAnalytics
        stats={stats}
        groupsSlot={
          picker && (
            <ItemGroups itemId={stats.itemId} member={picker.member} addable={picker.addable} />
          )
        }
        shareSlot={
          visibility && (
            <ShareToggle
              itemId={stats.itemId}
              initialPublic={visibility === 'public'}
              variant="icon"
            />
          )
        }
        voiceSpeaker={settings.voiceSpeaker}
        speechRate={settings.speechRate}
        showFurigana={furiganaInApp(settings.furiganaMode)}
      />
    </>
  );
}
