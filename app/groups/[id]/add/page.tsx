import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GroupItemPicker } from '@/components/groups/group-item-picker';
import { getGroup, listAddableItems } from '@/lib/groups';
import { getSettings } from '@/lib/practice';
import { getSessionUserId } from '@/lib/current-user';
import { furiganaInApp } from '@/lib/settings-schema';

export const metadata: Metadata = { title: 'Thêm mục vào nhóm — sakubun' };
export const dynamic = 'force-dynamic';

/**
 * "Thêm mục" for one group — a ROUTE, not a modal (2026-08-05). Loads exactly what the group detail page
 * loads for its (former) picker dialog: the group, plus the kind-guarded addable set. `listAddableItems`
 * returns null for a missing group, which `getGroup` has already 404'd on.
 */
export default async function GroupAddItemsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Auth gate: redirects to /login when there is no valid session.
  await getSessionUserId();
  const group = await getGroup(id);
  if (!group) notFound();
  const [addable, settings] = await Promise.all([listAddableItems(id), getSettings()]);

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
