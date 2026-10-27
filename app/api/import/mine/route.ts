import { routeUserId } from '@/lib/auth/current-user';
import { userDb } from '@/lib/db/user-db';
import { importAccountData } from '@/lib/transfer/import';
import { parseAccountBackup } from '@/lib/transfer/schema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const userId = await routeUserId('learner');
  if (userId instanceof Response) return userId;

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
    const result = await importAccountData(userDb(userId), parsed.data, { dryRun });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error('[import/mine] sync failed', err);
    return Response.json(
      { ok: false, error: 'Không nạp được dữ liệu vào tài khoản.' },
      { status: 500 },
    );
  }
}
