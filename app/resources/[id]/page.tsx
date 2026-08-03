import { notFound } from 'next/navigation';
import { LiveRefresh } from '@/components/shell/live-refresh';
import { ItemAnalytics } from '@/components/resources/item-analytics';
import { getItemStats } from '@/lib/item-stats';
import { getSettings } from '@/lib/practice';
import { getSessionUserId } from '@/lib/current-user';
import { furiganaInApp } from '@/lib/settings-schema';

export const dynamic = 'force-dynamic';

// Per-item analytics page ("card info", Anki-style) — reached from the ⋮ menu of either resources
// table. `id` is the Item cuid; works for both grammar and vocab (both carry FSRS state + a log).
// The group-membership and library-share slots were dropped with the community surface.
export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  const [stats, settings] = await Promise.all([getItemStats(userId, id), getSettings(userId)]);
  if (!stats) notFound();

  return (
    // No wrapper padding here: ItemAnalytics renders its own PageShell (which owns the py-6 rhythm) —
    // an outer py-8 double-padded the page top/bottom (layout std invariant #8).
    <>
      <LiveRefresh />
      <ItemAnalytics
        stats={stats}
        voiceSpeaker={settings.voiceSpeaker}
        speechRate={settings.speechRate}
        showFurigana={furiganaInApp(settings.furiganaMode)}
      />
    </>
  );
}
