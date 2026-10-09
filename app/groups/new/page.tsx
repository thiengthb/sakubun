import type { Metadata } from 'next';
import { GroupFormPage } from '@/components/features/groups/group-form-page';
import { getSessionUserId } from '@/lib/auth/current-user';

export const metadata: Metadata = { title: 'Tạo nhóm — sakubun' };
export const dynamic = 'force-dynamic';

export default async function NewGroupRoute() {
  await getSessionUserId();
  return <GroupFormPage />;
}
