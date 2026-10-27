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
        ...a,
        createdAt: a.createdAt.toISOString(),
        lastReviewAt: a.lastReviewAt?.toISOString() ?? null,
      }))}
    />
  );
}
