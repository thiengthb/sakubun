import { notFound } from 'next/navigation';
import { GroupDetailView } from '@/components/groups/group-detail-view';
import { getGroup, listAddableItems } from '@/lib/groups';
import { getSettings } from '@/lib/practice';
import { getSessionUserId } from '@/lib/current-user';
import { furiganaInApp } from '@/lib/settings-schema';

export const dynamic = 'force-dynamic';

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getSessionUserId();
  const group = await getGroup(id);
  if (!group) notFound();
  const [addable, settings] = await Promise.all([
    listAddableItems(id),
    getSettings(),
  ]);
  return (
    <GroupDetailView
      group={group}
      addable={addable ?? []}
      voiceSpeaker={settings.voiceSpeaker}
      speechRate={settings.speechRate}
      showFurigana={furiganaInApp(settings.furiganaMode)}
    />
  );
}
