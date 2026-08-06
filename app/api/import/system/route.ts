import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { importSystemBackup } from '@/lib/import';

// Whole-DB SYNC — the counterpart to GET /api/backup. The bytes are written to a temp file, then
// `importSystemBackup` ATTACHes it and merges table-by-table (INSERT OR IGNORE): add-only, nothing is
// deleted and nothing existing is overwritten. `session`/`verification` are skipped. `?dryRun=1` returns
// the per-table counts without writing. This is a MERGE, not a file swap, so the DB stays open and
// intact (the 2026-07-20 "no in-app restore" decision).
//
// Gate: SIGNED IN. It was `role === 'admin'` back when the app had members to gate each other from;
// with one account that role is only a way for the tab's button to 403 on an account whose role was
// never stamped. The boundary in this app is login (AGENTS.md).

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Every SQLite database begins with a 16-byte magic; its first 15 bytes are this ASCII string (the 16th
// is a NUL). A cheap pre-check so an obviously-wrong upload fails before it is written or attached.
const SQLITE_MAGIC = 'SQLite format 3';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.banned) {
    return Response.json({ ok: false, error: 'Cần đăng nhập.' }, { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1';
  const tmp = join(tmpdir(), `sakubun-import-${randomUUID()}.db`);

  try {
    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.byteLength === 0) {
      return Response.json({ ok: false, error: 'Tệp rỗng.' }, { status: 400 });
    }
    if (buf.subarray(0, 15).toString('latin1') !== SQLITE_MAGIC) {
      return Response.json(
        { ok: false, error: 'Tệp không phải cơ sở dữ liệu SQLite.' },
        { status: 400 },
      );
    }

    await writeFile(tmp, buf);
    const result = await importSystemBackup(tmp, { dryRun });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error('[import/system] sync failed', err);
    // Operator-only surface: the thrown messages are our own Vietnamese validation notes, safe to show.
    const message = err instanceof Error ? err.message : 'Không nạp được bản sao lưu.';
    return Response.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await rm(tmp, { force: true });
  }
}
