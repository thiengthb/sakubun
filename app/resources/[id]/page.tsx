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

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getSessionUserId();
  const [stats, settings, picker] = await Promise.all([
    getItemStats(id),
    getSettings(),
    getItemGroupPicker(id),
  ]);
  if (!stats) notFound();

  return (
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
