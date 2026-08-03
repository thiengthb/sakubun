import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // A plain connectivity probe (not a tenant-model read) — it needs no userId, so it stays exempt
    // from the multi-tenancy guard and does not depend on any particular row existing.
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
