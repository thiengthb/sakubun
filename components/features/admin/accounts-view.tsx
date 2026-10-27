'use client';

import Link from 'next/link';
import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/empty-state';
import { LIST_CARD } from '@/components/common/list-card';
import { RelativeTime } from '@/components/common/relative-time';
import { PageShell } from '@/components/layout/page-shell';
import { UserAvatar } from '@/components/layout/user-avatar';
import { AccountActions } from '@/components/features/admin/account-actions';
import { cn } from '@/lib/core/utils';

export type AccountCardRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  access: 'admin' | 'learner' | 'none';
  banned: boolean;
  lastReviewAt: string | null;
};

const GRID = 'grid grid-cols-1 gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3';

export function AccountStatusBadge({
  access,
  banned,
}: Pick<AccountCardRow, 'access' | 'banned'>) {
  if (banned)
    return (
      <Badge variant="destructive" className="px-1.5 py-0 text-xs">
        Bị chặn
      </Badge>
    );
  return (
    <Badge variant="outline" className="px-1.5 py-0 text-xs">
      {access === 'admin' ? 'Quản trị' : 'Người học'}
    </Badge>
  );
}

// One account: who, the menu, then status and last review. Everything else is on the account page
// the card opens.
function AccountCard({ row }: { row: AccountCardRow }) {
  return (
    <li className={cn(LIST_CARD.base, LIST_CARD.linked, 'space-y-2')}>
      <Link href={`/admin/${row.id}`} className={LIST_CARD.link}>
        <span className="sr-only">Mở tài khoản {row.email}</span>
      </Link>
      <div className="flex items-start gap-3">
        <UserAvatar
          name={row.name || row.email}
          image={row.image}
          className={cn('size-9', row.banned && 'opacity-60')}
        />
        <div className={cn('min-w-0 flex-1', row.banned && 'opacity-60')}>
          <p className="truncate font-medium">{row.name || row.email}</p>
          <p className="truncate text-sm text-muted-foreground">{row.email}</p>
        </div>
        {row.access !== 'admin' && <AccountActions account={row} />}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <AccountStatusBadge access={row.access} banned={row.banned} />
        <span className="whitespace-nowrap">
          {row.lastReviewAt ? (
            <>
              Ôn <RelativeTime value={row.lastReviewAt} />
            </>
          ) : (
            'Chưa ôn'
          )}
        </span>
      </div>
    </li>
  );
}

/** Every account, oldest first (roadmap 7.2c). Anyone may sign up; the admin bans or deletes. */
export function AccountsView({ accounts }: { accounts: AccountCardRow[] }) {
  return (
    <PageShell template="list" title="Quản trị" meta={`${accounts.length} tài khoản`}>
      {accounts.length === 0 ? (
        <EmptyState icon={Users} title="Chưa có tài khoản nào" />
      ) : (
        <div className="@container">
          <ul className={GRID}>
            {accounts.map((row) => (
              <AccountCard key={row.id} row={row} />
            ))}
          </ul>
        </div>
      )}
    </PageShell>
  );
}
