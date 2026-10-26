import { headers } from 'next/headers';
import { auth } from '@/lib/auth/auth';
import { userDb } from '@/lib/db/user-db';
import { exportUserData } from '@/lib/transfer/export';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.banned) {
    return Response.json({ ok: false, error: 'Cần đăng nhập.' }, { status: 401 });
  }

  try {
    const data = await exportUserData(userDb(session.user.id));
    const day = new Date().toISOString().slice(0, 10);
    const body = JSON.stringify(data, null, 2);

    return new Response(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="sakubun-my-data-${day}.json"`,
        'Cache-Control': 'no-store',
        'X-Sakubun-Items': String(data.counts.items),
      },
    });
  } catch (err) {
    console.error('[export] per-user export failed', err);
    return Response.json({ ok: false, error: 'Không tạo được bản xuất dữ liệu.' }, { status: 500 });
  }
}
