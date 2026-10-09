import { notFound } from 'next/navigation';
import { GroupDetailView } from '@/components/features/groups/group-detail-view';
import { getGroup, listAddableItems } from '@/lib/library/groups';
import { getSettings } from '@/lib/library/practice';
import { getSessionUserId } from '@/lib/auth/current-user';
import { furiganaInApp } from '@/lib/settings/schema';

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
