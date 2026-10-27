import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { routeUserId } from '@/lib/auth/current-user';
import { importSystemBackup } from '@/lib/transfer/import';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SQLITE_MAGIC = 'SQLite format 3';

export async function POST(req: Request) {
  const caller = await routeUserId('admin');
  if (caller instanceof Response) return caller;

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
    const message = err instanceof Error ? err.message : 'Không nạp được bản sao lưu.';
    return Response.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await rm(tmp, { force: true });
  }
}
