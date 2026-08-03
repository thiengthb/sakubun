import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { exportUserData } from '@/lib/export';

// Per-user data export (multi-user, 2026-07-22). Any signed-in member can download a JSON copy of
// THEIR OWN data (items, FSRS states, review history, sentences, settings, groups). Distinct from
// app/api/backup, which is the admin-only whole-DB snapshot spanning every member. exportUserData
// scopes every query by the session userId, so a member can only ever get their own rows.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.banned) {
    return Response.json({ ok: false, error: 'Cần đăng nhập.' }, { status: 401 });
  }

  try {
    const data = await exportUserData(session.user.id);
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
