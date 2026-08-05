import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { headers } from 'next/headers';
import Database from 'better-sqlite3';
import { auth } from '@/lib/auth';

// Download a consistent snapshot of the whole library. Every review, every FSRS state and every
// enrichment card lives in ONE SQLite file inside a Docker volume, and until now there was no way to
// get a copy out — a `docker volume rm` was unrecoverable.
//
// `VACUUM INTO` is the right tool rather than copying the file: it takes a read transaction, so the
// snapshot is internally consistent even if a review is written mid-copy, and it compacts as it goes.
// Plain `cp` of a live SQLite file can capture a torn page and produce a backup that only fails when
// you finally need it.
//
// Gate: SIGNED IN. This was admin-only (plan 2026-07-21, step 2.9) while the app was multi-user and the
// snapshot spanned every member's data. With one account there is nobody to gate it from, and keeping
// the role check only created a way for the settings Data tab's download button to 403 on an account
// whose `role` was never stamped. The boundary in this app is login (AGENTS.md).

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** `file:/data/sakubun.db` -> `/data/sakubun.db`. Prisma's URL form is not a filesystem path. */
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

    // Read back through a fresh connection and prove the snapshot is sound BEFORE handing it over.
    // A backup that is only checked when you need it is not a backup.
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
        // Lets the UI report what was actually captured instead of just "downloaded".
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
