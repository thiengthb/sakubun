import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GroupFormPage } from '@/components/features/groups/group-form-page';
import { getGroup } from '@/lib/library/groups';
import { getUserDb } from '@/lib/auth/current-user';

export const metadata: Metadata = { title: 'Sửa nhóm — sakubun' };
export const dynamic = 'force-dynamic';

export default async function GroupEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getUserDb();
  const group = await getGroup(db, id);
  if (!group) notFound();

  return <GroupFormPage group={group} />;
}
