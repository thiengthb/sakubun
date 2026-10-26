import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GroupItemPicker } from '@/components/features/groups/group-item-picker';
import { getGroup, listAddableItems } from '@/lib/library/groups';
import { getSettings } from '@/lib/library/practice';
import { getUserDb } from '@/lib/auth/current-user';
import { furiganaInApp } from '@/lib/settings/schema';

export const metadata: Metadata = { title: 'Thêm mục vào nhóm — sakubun' };
export const dynamic = 'force-dynamic';

export default async function GroupAddItemsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getUserDb();
  const group = await getGroup(db, id);
  if (!group) notFound();
  const [addable, settings] = await Promise.all([listAddableItems(db, id), getSettings(db)]);

  return (
    <GroupItemPicker
      group={group}
      addable={addable ?? []}
      voiceSpeaker={settings.voiceSpeaker}
      speechRate={settings.speechRate}
      showFurigana={furiganaInApp(settings.furiganaMode)}
    />
  );
}
