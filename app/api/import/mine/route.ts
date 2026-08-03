import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { importAccountData } from '@/lib/import';
import { parseAccountBackup } from '@/lib/import-schema';

// Per-user data SYNC — the counterpart to GET /api/export/mine. A signed-in member uploads the JSON they
// previously downloaded (or one from another instance) and it is MERGED into their account: rows missing
// locally are added, existing rows are updated, nothing is deleted (ReviewLog is insert-only, invariant
// #2). `importAccountData` forces userId to the session user, so a file can only ever write into the
// uploader's OWN account. `?dryRun=1` returns the per-table counts WITHOUT writing (the preview step).

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
    const result = await importAccountData(parsed.data, { dryRun });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error('[import/mine] sync failed', err);
    return Response.json(
      { ok: false, error: 'Không nạp được dữ liệu vào tài khoản.' },
      { status: 500 },
    );
  }
}
