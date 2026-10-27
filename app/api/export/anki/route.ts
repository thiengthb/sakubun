import { routeUserId } from '@/lib/auth/current-user';
import { userDb } from '@/lib/db/user-db';
import { exportVocabApkg } from '@/lib/transfer/export';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const userId = await routeUserId('learner');
  if (userId instanceof Response) return userId;

  try {
    const { count, bytes } = await exportVocabApkg(userDb(userId));
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
