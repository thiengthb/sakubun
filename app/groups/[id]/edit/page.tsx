import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GroupFormPage } from '@/components/groups/group-form-page';
import { getGroup } from '@/lib/groups';
import { getSessionUserId } from '@/lib/current-user';

export const metadata: Metadata = { title: 'Sửa nhóm — sakubun' };
export const dynamic = 'force-dynamic';

/**
 * "Sửa nhóm" — a ROUTE, not a modal (2026-08-05), matching `/resources/<id>/edit`.
 *
 * Reads through `getGroup` (the same loader the detail page uses) rather than a second narrower query:
 * it carries every editable field plus the existence check, so a missing id 404s here exactly as it does
 * there. The member list it also returns is unused by the form — cheap enough not to warrant a second
 * query path that could drift from the one the detail page trusts.
 */
export default async function GroupEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Auth gate: redirects to /login when there is no valid session.
  await getSessionUserId();
  const group = await getGroup(id);
  if (!group) notFound();

  return <GroupFormPage group={group} />;
}
