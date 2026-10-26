import { headers } from 'next/headers';
import { auth } from '@/lib/auth/auth';
import { userDb } from '@/lib/db/user-db';
import { exportVocabApkg } from '@/lib/transfer/export';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.banned) {
    return Response.json({ ok: false, error: 'Cần đăng nhập.' }, { status: 401 });
  }

  try {
    const { count, bytes } = await exportVocabApkg(userDb(session.user.id));
    const day = new Date().toISOString().slice(0, 10);

    return new Response(bytes as BodyInit, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="sakubun-vocab-${day}.apkg"`,
        'Cache-Control': 'no-store',
        'X-Sakubun-Items': String(count),
      },
    });
  } catch (err) {
    console.error('[export] anki apkg export failed', err);
    return Response.json({ ok: false, error: 'Không tạo được tệp Anki.' }, { status: 500 });
  }
}
