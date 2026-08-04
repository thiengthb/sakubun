import { notFound } from 'next/navigation';
import { LiveRefresh } from '@/components/shell/live-refresh';
import { ItemAnalytics } from '@/components/resources/item-analytics';
import { ItemGroups } from '@/components/resources/item-groups';
import { getItemStats } from '@/lib/item-stats';
import { getItemGroupPicker } from '@/lib/groups';
import { getSettings } from '@/lib/practice';
import { getSessionUserId } from '@/lib/current-user';
import { furiganaInApp } from '@/lib/settings-schema';

export const dynamic = 'force-dynamic';

// Per-item analytics page ("card info", Anki-style) — reached from the ⋮ menu of either resources
// table. `id` is the Item cuid; works for both grammar and vocab (both carry FSRS state + a log).
//
// The share slot stayed dropped (there is no public library any more), but `groupsSlot` is filled
// again as of 2026-08-05: study groups came back single-user, and this is where "which groups is this
// in, and put it in another" belongs — the picker is kind-guarded server-side, so the client only ever
// fires add/remove over one item.
export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Auth gate: redirects to /login when there is no valid session.
  await getSessionUserId();
  const [stats, settings, picker] = await Promise.all([
    getItemStats(id),
    getSettings(),
    getItemGroupPicker(id),
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
          picker && <ItemGroups itemId={id} member={picker.member} addable={picker.addable} />
        }
        voiceSpeaker={settings.voiceSpeaker}
        speechRate={settings.speechRate}
        showFurigana={furiganaInApp(settings.furiganaMode)}
      />
    </>
  );
}
