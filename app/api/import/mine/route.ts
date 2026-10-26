import { headers } from 'next/headers';
import { auth } from '@/lib/auth/auth';
import { userDb } from '@/lib/db/user-db';
import { importAccountData } from '@/lib/transfer/import';
import { parseAccountBackup } from '@/lib/transfer/schema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.banned) {
    return Response.json({ ok: false, error: 'Cần đăng nhập.' }, { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1';

  let raw: unknown;
  try {
    raw = JSON.parse(await req.text());
  } catch {
    return Response.json({ ok: false, error: 'Tệp không phải JSON hợp lệ.' }, { status: 400 });
  }

  const parsed = parseAccountBackup(raw);
  if (!parsed.ok) {
    return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  try {
    const result = await importAccountData(userDb(session.user.id), parsed.data, { dryRun });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error('[import/mine] sync failed', err);
    return Response.json(
      { ok: false, error: 'Không nạp được dữ liệu vào tài khoản.' },
      { status: 500 },
    );
  }
}
