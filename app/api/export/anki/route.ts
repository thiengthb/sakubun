import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { exportVocabApkg } from '@/lib/export';

// Anki deck export (2026-07-23). Streams the signed-in member's vocabulary as an .apkg they import
// into their OWN Anki — the multi-user-safe replacement for the removed AnkiConnect push, which could
// only ever reach the Anki running on the container's host machine. exportVocabApkg scopes its query
// by the session userId, so a member can only ever export their own words.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.banned) {
    return Response.json({ ok: false, error: 'Cần đăng nhập.' }, { status: 401 });
  }

  try {
    const { count, bytes } = await exportVocabApkg();
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
