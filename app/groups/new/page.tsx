import type { Metadata } from 'next';
import { GroupFormPage } from '@/components/groups/group-form-page';
import { getSessionUserId } from '@/lib/current-user';

export const metadata: Metadata = { title: 'Tạo nhóm — sakubun' };
export const dynamic = 'force-dynamic';

/**
 * "Tạo nhóm" — a ROUTE, not a modal (2026-08-05), matching `/resources/new`. See `GroupFormPage` for
 * why. Nothing to load: the form starts empty and the create action is a server action.
 */
export default async function NewGroupRoute() {
  // Auth gate: redirects to /login when there is no valid session.
  await getSessionUserId();
  return <GroupFormPage />;
}
