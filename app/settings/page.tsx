import { redirect } from 'next/navigation';
import { SettingsForm } from '@/components/settings/settings-form';
import { getSettings } from '@/lib/practice';
import { getOptionalSessionUser } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  // Need the user object (not just the id): the Data tab shows the whole-DB backup only to an admin.
  const user = await getOptionalSessionUser();
  if (!user) redirect('/login');

  const settings = await getSettings(user.id);

  return <SettingsForm initial={settings} isAdmin={user.role === 'admin'} />;
}
