import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { headers } from 'next/headers';
import Database from 'better-sqlite3';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function dbPath(): string {
  const url = process.env.DATABASE_URL || 'file:./dev.db';
  return url.startsWith('file:') ? url.slice('file:'.length) : url;
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.banned) {
    return Response.json({ ok: false, error: 'Cần đăng nhập.' }, { status: 401 });
  }

  const out = join(tmpdir(), `sakubun-snapshot-${randomUUID()}.db`);

  try {
    const db = new Database(dbPath());
    try {
      db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
    } finally {
      db.close();
    }

    const check = new Database(out, { readonly: true });
    let integrity: string;
    let items: number;
    try {
      integrity = check.pragma('integrity_check', { simple: true }) as string;
      items = (check.prepare('SELECT count(*) AS n FROM Item').get() as { n: number }).n;
    } finally {
      check.close();
    }
    if (integrity !== 'ok') throw new Error(`snapshot failed integrity_check: ${integrity}`);

    const body = await readFile(out);
    const day = new Date().toISOString().slice(0, 10);

    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': 'application/vnd.sqlite3',
        'Content-Disposition': `attachment; filename="sakubun-${day}.db"`,
        'Content-Length': String(body.byteLength),
        'Cache-Control': 'no-store',
        'X-Sakubun-Items': String(items),
      },
    });
  } catch (err) {
    console.error('[backup] snapshot failed', err);
    return Response.json({ ok: false, error: 'Không tạo được bản sao lưu.' }, { status: 500 });
  } finally {
    await rm(out, { force: true });
  }
}
