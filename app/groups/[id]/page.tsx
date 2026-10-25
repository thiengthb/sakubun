import { notFound } from 'next/navigation';
import { GroupDetailView } from '@/components/features/groups/group-detail-view';
import { getGroup } from '@/lib/library/groups';
import { getItemCards } from '@/lib/app/quick-review';
import { getSettings } from '@/lib/library/practice';
import { getSessionUserId } from '@/lib/auth/current-user';
import { furiganaInApp } from '@/lib/settings/schema';

export const dynamic = 'force-dynamic';

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getSessionUserId();
  const group = await getGroup(id);
  if (!group) notFound();
  const [settings, cards] = await Promise.all([
    getSettings(),
    getItemCards(group.members.map((m) => m.itemId)),
  ]);
  return (
    <GroupDetailView
      group={group}
      cards={cards}
      voiceSpeaker={settings.voiceSpeaker}
      speechRate={settings.speechRate}
      showFurigana={furiganaInApp(settings.furiganaMode)}
    />
  );
}
