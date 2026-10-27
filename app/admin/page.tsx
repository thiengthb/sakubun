import { AccountsView } from '@/components/features/admin/accounts-view';
import { getAdminUserId } from '@/lib/auth/current-user';
import { listAccounts } from '@/lib/admin/accounts';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await getAdminUserId();
  const accounts = await listAccounts();
  return (
    <AccountsView
      accounts={accounts.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        image: a.image,
        access: a.access,
        banned: a.banned,
        lastReviewAt: a.lastReviewAt?.toISOString() ?? null,
      }))}
    />
  );
}
