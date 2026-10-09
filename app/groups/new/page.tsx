import type { Metadata } from 'next';
import { GroupFormPage } from '@/components/groups/group-form-page';
import { getSessionUserId } from '@/lib/current-user';

export const metadata: Metadata = { title: 'Tạo nhóm — sakubun' };
export const dynamic = 'force-dynamic';

export default async function NewGroupRoute() {
  await getSessionUserId();
  return <GroupFormPage />;
}
