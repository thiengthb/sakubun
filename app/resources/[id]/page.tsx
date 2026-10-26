import { notFound } from 'next/navigation';
import { LiveRefresh } from '@/components/layout/live-refresh';
import { ItemAnalytics } from '@/components/features/resources/item-analytics';
import { ItemGroups } from '@/components/features/resources/item-groups';
import { getItemStats } from '@/lib/insights/item-stats';
import { getItemGroupPicker } from '@/lib/library/groups';
import { getSettings } from '@/lib/library/practice';
import { getUserDb } from '@/lib/auth/current-user';
import { furiganaInApp } from '@/lib/settings/schema';

export const dynamic = 'force-dynamic';

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getUserDb();
  const [stats, settings, picker] = await Promise.all([
    getItemStats(db, id),
    getSettings(db),
    getItemGroupPicker(db, id),
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
