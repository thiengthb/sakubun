import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GroupFormPage } from '@/components/groups/group-form-page';
import { getGroup } from '@/lib/groups';
import { getSessionUserId } from '@/lib/current-user';

export const metadata: Metadata = { title: 'Sửa nhóm — sakubun' };
export const dynamic = 'force-dynamic';

export default async function GroupEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getSessionUserId();
  const group = await getGroup(id);
  if (!group) notFound();

  return <GroupFormPage group={group} />;
}
