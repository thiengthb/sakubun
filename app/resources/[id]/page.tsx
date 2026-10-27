import { notFound } from 'next/navigation';
import { LiveRefresh } from '@/components/layout/live-refresh';
import { ItemAnalytics } from '@/components/features/resources/item-analytics';
import { ItemGroups } from '@/components/features/resources/item-groups';
import { getItemStats } from '@/lib/insights/item-stats';
import { ItemShareButton } from '@/components/common/share-to-library';
import { getItemGroupPicker } from '@/lib/library/groups';
import { itemShareStatus } from '@/lib/library/publish';
import { getSettings } from '@/lib/library/practice';
import { getUserDb } from '@/lib/auth/current-user';
import { furiganaInApp } from '@/lib/settings/schema';

export const dynamic = 'force-dynamic';

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getUserDb();
  const [stats, settings, picker, share] = await Promise.all([
    getItemStats(db, id),
    getSettings(db),
    getItemGroupPicker(db, id),
    itemShareStatus(db, id),
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
        shareSlot={share && <ItemShareButton itemId={id} status={share} />}
        voiceSpeaker={settings.voiceSpeaker}
        speechRate={settings.speechRate}
        showFurigana={furiganaInApp(settings.furiganaMode)}
      />
    </>
  );
}
