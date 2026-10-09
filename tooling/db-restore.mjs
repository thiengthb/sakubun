#!/usr/bin/env node
/**
 * Restore a whole sakubun database from another machine, overwriting the one in place.
 *
 *   node tooling/db-restore.mjs <duong-dan.db> [--yes]
 *
 * The multi-machine story this exists for: you study on machine A, the SQLite file there is the whole
 * of your data, and you want machine B to BE machine A. The app's own import (lib/import.ts) merges a
 * JSON backup into an existing store — right for "add these items", wrong for "make this box identical
 * to that box", which is what this script does.
 *
 * Doing it by hand is a five-step dance across a stopped container and a named volume, and every step
 * is silent when wrong: copy into a stopped container and the file lands in the container layer, not
 * the volume; forget the -wal file and SQLite resurrects rows you thought you replaced; forget chown
 * and the app boots read-only. So it lives here instead of in someone's memory.
 *
 * SAFETY: the current database is tarred into backups/ BEFORE anything is touched, and the exact
 * rollback command is printed at the end. Nothing here is a one-way door.
 *
 * Targets:
 *   --target docker  (default) the deployed container + its named volume
 *   --target local   the DATABASE_URL file, for a dev machine with no container
 */
import { existsSync, copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename, dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import Database from 'better-sqlite3';
import { REPO_ROOT, repoPath, run } from './lib/paths.mjs';

// Defaults match docker-compose.yml. The volume name is PINNED there (not derived from the project
// name) and this must not drift from it - see the warning in that file.
const DEFAULTS = {
  container: 'sakubun',
  volume: 'sakubun_sakubun_data',
  dbInVolume: 'sakubun.db',
  // uid:gid of `USER node` in the runtime image. A file owned by root makes the app boot read-only.
  owner: '1000:1000',
  helperImage: 'alpine',
  healthTimeoutMs: 180_000,
};

// Tables that must exist for the file to be a sakubun database rather than some other SQLite file.
const REQUIRED_TABLES = ['Item', 'SrsState', 'ReviewLog', 'Sentence', 'Settings', 'user', 'account'];
// Printed side by side so you see what you are trading before you say yes.
const COUNTED_TABLES = ['Item', 'SrsState', 'ReviewLog', 'Sentence', 'Settings', 'Group', 'GroupMember', 'user', 'account', 'mcp_key'];

function parseArgs(argv) {
  const opts = { ...DEFAULTS, target: 'docker', yes: false, dryRun: false, promoteAdmin: true, source: null, dbPath: null, backupDir: repoPath('..', 'backups') };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--yes' || a === '-y') opts.yes = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--no-promote-admin') opts.promoteAdmin = false;
    else if (a === '--target') opts.target = argv[++i];
    else if (a === '--container') opts.container = argv[++i];
    else if (a === '--volume') opts.volume = argv[++i];
    else if (a === '--db-path') opts.dbPath = argv[++i];
    else if (a === '--backup-dir') opts.backupDir = argv[++i];
    else if (a.startsWith('-')) fatal(`Cờ không hiểu: ${a}`);
    else rest.push(a);
  }
  opts.source = rest[0] ?? null;
  return opts;
}

function fatal(msg, hint) {
  console.error(`\nDỪNG: ${msg}`);
  if (hint) console.error(`      ${hint}`);
  process.exit(1);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function docker(args, { capture = true } = {}) {
  // shell:false always - a Windows path with a space would otherwise be split silently.
  return run('docker', args, { capture, shell: false });
}

/** Read the counts + migration list of a .db file on this filesystem. Never mutates it. */
function inspectDb(path) {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const integrity = db.pragma('integrity_check', { simple: true });
    const tables = new Set(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name),
    );
    const counts = {};
    for (const t of COUNTED_TABLES) {
      counts[t] = tables.has(t) ? db.prepare(`SELECT COUNT(*) n FROM "${t}"`).get().n : null;
    }
    let migrations = [];
    if (tables.has('_prisma_migrations')) {
      migrations = db
        .prepare('SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at')
        .all();
    }
    const accounts = tables.has('user')
      ? db
          .prepare(
            'SELECT u.email, u.role, (SELECT group_concat(a.providerId) FROM account a WHERE a.userId = u.id) AS providers,' +
              ' (SELECT COUNT(*) FROM account a WHERE a.userId = u.id AND a.password IS NOT NULL) AS pw FROM user u',
          )
          .all()
      : [];
    return { integrity, tables, counts, migrations, accounts };
  } finally {
    db.close();
  }
}

/** Migration folders committed in this repo, in apply order. */
function repoMigrations() {
  const dir = repoPath('prisma', 'migrations');
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/**
 * A source DB is only safe to restore if this checkout knows every migration it has already applied.
 * Ahead-of-repo is the dangerous direction: the file came from a branch this checkout does not have,
 * and the app would run against columns its client does not know about.
 */
function diffMigrations(sourceMigrations, repoNames) {
  const applied = sourceMigrations.map((m) => m.migration_name);
  const known = new Set(repoNames);
  return {
    unfinished: sourceMigrations.filter((m) => !m.finished_at).map((m) => m.migration_name),
    unknown: applied.filter((n) => !known.has(n)),
    pending: repoNames.filter((n) => !applied.includes(n)),
  };
}

function countsTable(label, a, b) {
  const rows = COUNTED_TABLES.map((t) => {
    const fmt = (v) => (v === null ? '-' : String(v));
    return `  ${t.padEnd(13)} ${fmt(a[t]).padStart(7)}   ->${fmt(b[t]).padStart(7)}`;
  });
  return [`  ${'bảng'.padEnd(13)} ${label[0].padStart(7)}     ${label[1].padStart(7)}`, ...rows].join('\n');
}

/** Copy the target DB out of the docker volume so it can be read with better-sqlite3 locally. */
function pullFromVolume(opts, stageDir, name) {
  const r = docker([
    'run', '--rm',
    '-v', `${opts.volume}:/data:ro`,
    '-v', `${stageDir}:/stage`,
    opts.helperImage,
    'sh', '-c', `cp /data/${opts.dbInVolume} /stage/${name} 2>/dev/null || exit 3`,
  ]);
  if (r.status === 3) return null; // volume has no database yet - a first-ever restore
  if (r.status !== 0) fatal(`Không đọc được DB trong volume ${opts.volume}`, r.stderr);
  return join(stageDir, name);
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const a = (await rl.question(`${question} [gõ ĐỒNG Ý để tiếp tục]: `)).trim();
    return a === 'ĐỒNG Ý' || a === 'DONG Y' || a === 'yes';
  } finally {
    rl.close();
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.source) {
    console.log('Cách dùng: node tooling/db-restore.mjs <duong-dan.db> [--yes] [--dry-run]');
    console.log('           [--target docker|local] [--container ten] [--volume ten]');
    console.log('           [--db-path duong-dan] [--backup-dir thu-muc] [--no-promote-admin]');
    process.exit(1);
  }
  const source = resolve(opts.source);
  if (!existsSync(source)) fatal(`Không thấy file nguồn: ${source}`);
  if (statSync(source).size === 0) fatal('File nguồn rỗng.');

  console.log(`\nNguồn : ${source}`);
  console.log(`Đích  : ${opts.target === 'docker' ? `volume ${opts.volume} (container ${opts.container})` : 'file cục bộ'}`);

  // ── 1. Validate the source before touching anything ──────────────────────────
  const src = inspectDb(source);
  if (src.integrity !== 'ok') fatal(`integrity_check của file nguồn: ${src.integrity}`);
  const missing = REQUIRED_TABLES.filter((t) => !src.tables.has(t));
  if (missing.length) fatal(`File nguồn thiếu bảng: ${missing.join(', ')}`, 'Đây có phải DB của sakubun không?');

  const diff = diffMigrations(src.migrations, repoMigrations());
  if (diff.unfinished.length) {
    fatal(`Nguồn có migration chưa hoàn tất: ${diff.unfinished.join(', ')}`, 'DB bị bỏ dở giữa chừng - đừng restore.');
  }
  if (diff.unknown.length) {
    fatal(
      `Nguồn có migration mà checkout này KHÔNG biết: ${diff.unknown.join(', ')}`,
      'File tới từ nhánh mới hơn. Cập nhật code trước, đừng hạ cấp DB.',
    );
  }
  console.log(
    `\nMigration: nguồn ${src.migrations.length} đã áp` +
      (diff.pending.length ? `, còn thiếu ${diff.pending.length} (sẽ tự áp khi khởi động)` : ', khớp head'),
  );

  console.log('\nTài khoản trong file nguồn:');
  for (const a of src.accounts) {
    console.log(`  ${a.email}  role=${a.role ?? '-'}  provider=${a.providers ?? 'none'}  password=${a.pw ? 'có' : 'không'}`);
  }
  if (src.accounts.length && !src.accounts.some((a) => a.pw || (a.providers ?? '').includes('google'))) {
    fatal('Không tài khoản nào trong file nguồn có đường đăng nhập.', 'Restore xong sẽ không vào được app.');
  }

  // ── 2. Stage a working copy - the source file itself is never modified ───────
  const stageDir = join(tmpdir(), `sakubun-restore-${stamp()}`);
  mkdirSync(stageDir, { recursive: true });
  const staged = join(stageDir, DEFAULTS.dbInVolume);
  copyFileSync(source, staged);

  // The single account IS the operator (see the user.create after-hook in lib/auth.ts). A DB carried
  // from a machine where that account predates the convention arrives with role='user', which silently
  // removes the admin surface. Fix it on the staged copy, before it goes anywhere.
  if (opts.promoteAdmin) {
    const db = new Database(staged);
    try {
      const n = db.prepare("UPDATE user SET role = 'admin' WHERE role IS NULL OR role != 'admin'").run().changes;
      if (n) console.log(`\nĐặt role=admin cho ${n} tài khoản (bỏ qua bằng --no-promote-admin).`);
    } finally {
      db.close();
    }
  }

  // ── 3. Show the trade and ask ────────────────────────────────────────────────
  const targetPath =
    opts.target === 'docker'
      ? pullFromVolume(opts, stageDir, 'current.db')
      : opts.dbPath
        ? resolve(opts.dbPath)
        : resolve(REPO_ROOT, (process.env.DATABASE_URL ?? 'file:./prisma/dev.db').replace(/^file:/, ''));

  const cur = targetPath && existsSync(targetPath) ? inspectDb(targetPath) : null;
  const stagedCounts = inspectDb(staged).counts;
  console.log('\nGHI ĐÈ TOÀN BỘ - dữ liệu đích bị thay, không phải trộn:\n');
  console.log(countsTable(['đang có', 'sau khi'], cur ? cur.counts : Object.fromEntries(COUNTED_TABLES.map((t) => [t, null])), stagedCounts));

  if (opts.dryRun) {
    console.log('\n--dry-run: dừng ở đây, chưa đụng gì.');
    rmSync(stageDir, { recursive: true, force: true });
    return;
  }
  if (!opts.yes && !(await confirm('\nGhi đè database đích?'))) {
    console.log('Huỷ.');
    rmSync(stageDir, { recursive: true, force: true });
    process.exit(1);
  }

  // ── 4. Back up what is about to be replaced ─────────────────────────────────
  mkdirSync(opts.backupDir, { recursive: true });
  const backup = join(opts.backupDir, `sakubun-before-restore-${stamp()}.${opts.target === 'docker' ? 'tar.gz' : 'db'}`);
  if (opts.target === 'docker') {
    const r = docker([
      'run', '--rm',
      '-v', `${opts.volume}:/data:ro`,
      '-v', `${dirname(backup)}:/backup`,
      opts.helperImage,
      'tar', 'czf', `/backup/${basename(backup)}`, '-C', '/data', '.',
    ]);
    if (r.status !== 0) fatal('Backup volume thất bại - không restore.', r.stderr);
  } else if (targetPath && existsSync(targetPath)) {
    copyFileSync(targetPath, backup);
  }
  console.log(`\nĐã backup bản đang có: ${backup}`);

  // ── 5. Replace ──────────────────────────────────────────────────────────────
  if (opts.target === 'docker') {
    docker(['stop', opts.container]);
    // -wal and -shm MUST go with the file: SQLite would replay the old journal over the new database.
    const r = docker([
      'run', '--rm',
      '-v', `${opts.volume}:/data`,
      '-v', `${stageDir}:/stage:ro`,
      opts.helperImage,
      'sh', '-c',
      `cp /stage/${DEFAULTS.dbInVolume} /data/${opts.dbInVolume} && rm -f /data/${opts.dbInVolume}-wal /data/${opts.dbInVolume}-shm && chown ${opts.owner} /data/${opts.dbInVolume}`,
    ]);
    if (r.status !== 0) fatal('Chép DB vào volume thất bại.', `${r.stderr}\nKhôi phục: xem lệnh rollback bên dưới.`);
    const up = docker(['start', opts.container]);
    if (up.status !== 0) fatal('Không khởi động lại được container.', up.stderr);

    // The container applies pending migrations at start, so "healthy" is the real done signal.
    const deadline = Date.now() + opts.healthTimeoutMs;
    let health = '';
    while (Date.now() < deadline) {
      health = docker(['inspect', '--format', '{{.State.Health.Status}}', opts.container]).stdout;
      if (health === 'healthy' || health === 'unhealthy') break;
      await new Promise((r) => setTimeout(r, 3000));
    }
    if (health !== 'healthy') {
      fatal(`Container không healthy (${health || 'không đọc được'}).`, `Xem log: docker logs ${opts.container}`);
    }
    console.log('Container: healthy');
  } else {
    for (const suffix of ['', '-wal', '-shm']) {
      const p = `${targetPath}${suffix}`;
      if (existsSync(p)) rmSync(p);
    }
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(staged, targetPath);
    console.log(`Đã ghi: ${targetPath}`);
    if (diff.pending.length) {
      const r = run('npx', ['prisma', 'migrate', 'deploy'], { capture: false, env: { DATABASE_URL: `file:${targetPath}` } });
      if (r.status !== 0) fatal('migrate deploy thất bại sau khi chép.');
    }
  }

  // ── 6. Verify against what actually landed, not against what we sent ─────────
  const after = opts.target === 'docker' ? pullFromVolume(opts, stageDir, 'after.db') : targetPath;
  const post = inspectDb(after);
  console.log('\nKiểm lại DB đích sau restore:');
  for (const t of COUNTED_TABLES) console.log(`  ${t.padEnd(13)} ${String(post.counts[t] ?? '-').padStart(7)}`);
  const drift = COUNTED_TABLES.filter((t) => stagedCounts[t] !== post.counts[t]);
  // Pending migrations legitimately change the shape, so only flag drift when there were none.
  if (drift.length && !diff.pending.length) {
    console.log(`\nCẢNH BÁO: lệch so với nguồn ở: ${drift.join(', ')}`);
  }

  rmSync(stageDir, { recursive: true, force: true });
  console.log('\nXONG.');
  console.log('Quay lại bản trước nếu cần:');
  if (opts.target === 'docker') {
    console.log(`  docker stop ${opts.container}`);
    console.log(`  docker run --rm -v ${opts.volume}:/data -v "${dirname(backup)}":/backup ${opts.helperImage} sh -c "rm -f /data/* && tar xzf /backup/${basename(backup)} -C /data && chown -R ${opts.owner} /data"`);
    console.log(`  docker start ${opts.container}`);
  } else {
    console.log(`  copy ${backup} -> ${targetPath}`);
  }
}

main().catch((e) => fatal(e.message));
