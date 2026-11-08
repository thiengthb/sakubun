import { AccountsView } from '@/components/features/admin/accounts-view';
import { getAdminUserId } from '@/lib/auth/current-user';
import { listAccounts } from '@/lib/admin/accounts';
import { prisma } from '@/lib/db/db';
import { listRemovedEntries } from '@/lib/library/moderation';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await getAdminUserId();
  const [accounts, removed] = await Promise.all([listAccounts(), listRemovedEntries(prisma)]);
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
      removed={removed.map(({ _count, ...s }) => ({ ...s, likes: _count.likes }))}
    />
  );
}
