import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { exportUserData } from '@/lib/export';

// The LEARNING-DATA export: a JSON copy of what the learner built — items, FSRS states, review history,
// sentences, settings and study groups. Distinct from app/api/backup, which is the whole-DB SQLite
// snapshot and the only COMPLETE copy (it also carries the auth tables and the tutor's own working
// state). lib/export.ts documents exactly what is in and out; the settings Data tab tells the learner.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.banned) {
    return Response.json({ ok: false, error: 'Cần đăng nhập.' }, { status: 401 });
  }

  try {
    const data = await exportUserData();
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
