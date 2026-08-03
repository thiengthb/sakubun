import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSessionUserId } from '@/lib/current-user';
import { AdminView } from '@/components/account/admin-view';

export const dynamic = 'force-dynamic';

// Operator-only control plane (ban / unban / force-logout). Gated on the admin role; a non-admin gets
// a 404 (the page's existence is not advertised). The first registered account is admin (lib/auth.ts).
export default async function AdminPage() {
  const userId = await getSessionUserId();
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (me?.role !== 'admin') notFound();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      banned: true,
      banReason: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // "Đăng nhập gần nhất" per user = their newest web session's createdAt (a session is minted at each
  // login). Session is a non-tenant auth model, queried freely. Small operator user base, so N reads
  // is fine.
  const lastLoginById = new Map(
    await Promise.all(
      users.map(async (u) => {
        const lastSession = await prisma.session.findFirst({
          where: { userId: u.id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });
        return [u.id, lastSession?.createdAt.toISOString() ?? null] as const;
      }),
    ),
  );

  return (
    <AdminView
      currentUserId={userId}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image ?? null,
        role: u.role ?? 'user',
        banned: Boolean(u.banned),
        banReason: u.banReason,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: lastLoginById.get(u.id) ?? null,
      }))}
    />
  );
}
