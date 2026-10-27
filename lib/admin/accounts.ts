// The admin page's reads and writes on accounts (roadmap 7.2c). Learning numbers are read through
// each account's own userDb, so the guard on learning tables still holds.
import { prisma } from '@/lib/db/db';
import { userDb } from '@/lib/db/user-db';
import { accountAccess, type AccountAccess } from '@/lib/auth/access';

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: Date;
  access: AccountAccess;
  banned: boolean;
  items: number;
  lastReviewAt: Date | null;
};

export async function listAccounts(): Promise<AccountRow[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      role: true,
      banned: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return Promise.all(
    users.map(async (u) => {
      const db = userDb(u.id);
      const [items, last] = await Promise.all([
        db.item.count(),
        db.reviewLog.findFirst({ orderBy: { reviewedAt: 'desc' }, select: { reviewedAt: true } }),
      ]);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        createdAt: u.createdAt,
        access: accountAccess({ ...u, banned: false }),
        banned: !!u.banned,
        items,
        lastReviewAt: last?.reviewedAt ?? null,
      };
    }),
  );
}

export async function findModerationTarget(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true, banned: true },
  });
}

// Banned: no new session, open sessions end now, and MCP keys and OAuth tokens stop working on their
// next call (accountAccess). The account and its learning data stay.
export async function setBanned(id: string, banned: boolean): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: banned
        ? { banned: true, banReason: 'Quản trị chặn' }
        : { banned: false, banReason: null },
    }),
    ...(banned ? [prisma.session.deleteMany({ where: { userId: id } })] : []),
  ]);
}

// Deletes the account and, through the foreign keys, everything it owns: learning data, review
// history, sessions, MCP keys and OAuth grants (decision 0006).
export async function deleteAccount(id: string): Promise<void> {
  await prisma.user.delete({ where: { id } });
}
