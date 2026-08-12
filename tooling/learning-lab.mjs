// PHÒNG LAB HỌC TẬP — một server sakubun sống lâu, DB riêng, tài khoản riêng, McpKey riêng, để
// người (hoặc agent) đi HẾT một buổi học thật qua bề mặt MCP và xem UI đổi theo từng lượt.
//
// Vì sao cần nó, và vì sao unit test + e2e không thay được:
//   - `lib/practice.test.ts` kiểm pipeline ở tầng hàm. `e2e/mcp-practice-loops.spec.ts` kiểm MỘT lượt
//     của mỗi kiểu luyện. Không có gì kiểm CẢ MỘT BUỔI: hạn mức ngày chạm đáy ở câu thứ mấy, lô rỗng
//     thì lời khuyên đưa ra có đúng không, chỉ tiêu ngày có đóng được không, chuyển dịch ↔ quiz giữa
//     buổi thì cài đặt còn nghĩa gì.
//   - Sáu lỗi tìm được trong buổi 2026-08-12 đều thuộc loại đó: chúng chỉ hiện ra khi đi liên tiếp
//     nhiều lượt trên MỘT tài khoản, không lượt nào trong đó tự sai.
//
// Cách dùng (Windows / macOS / Linux như nhau):
//
//     node tooling/learning-lab.mjs --fresh      # DB mới, tài khoản mới
//     node tooling/learning-lab.mjs              # giữ DB của buổi trước
//     node tooling/lab-mcp.mjs --list
//     node tooling/lab-mcp.mjs get_stats '{}'
//
// KHÔNG chạm dev (3789) hay e2e (3799). LƯU Ý: Next 16 từ chối hai dev server cùng một thư mục, nên
// lab và `npx playwright test` không chạy song song được — dừng lab trước khi chạy e2e.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';
import {
  LAB_AUTH_SECRET,
  LAB_BASE,
  LAB_DB,
  LAB_DIR,
  LAB_EMAIL,
  LAB_LOGIN,
  LAB_MCP_TOKEN,
  LAB_PORT,
} from './learning-lab-config.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

/** Áp mọi migration đã commit — cùng đường `lib/test-db.ts` đi, không cần Prisma CLI. */
function applyMigrations(dbFile) {
  const dir = path.join(ROOT, 'prisma', 'migrations');
  const db = new Database(dbFile);
  try {
    for (const name of readdirSync(dir)
      .filter((n) => statSync(path.join(dir, n)).isDirectory())
      .sort()) {
      db.exec(readFileSync(path.join(dir, name, 'migration.sql'), 'utf8'));
    }
  } finally {
    db.close();
  }
}

if (process.argv.includes('--fresh')) {
  for (const s of ['', '-wal', '-shm', '-journal']) rmSync(`${LAB_DB}${s}`, { force: true });
}
mkdirSync(LAB_DIR, { recursive: true });
if (!existsSync(LAB_DB)) applyMigrations(LAB_DB);

const child = spawn('npx', ['next', 'dev', '-p', String(LAB_PORT)], {
  cwd: ROOT,
  env: {
    ...process.env,
    DATABASE_URL: `file:${LAB_DB.replace(/\\/g, '/')}`, // Prisma cần dấu / kể cả trên Windows
    BETTER_AUTH_URL: LAB_BASE,
    BETTER_AUTH_SECRET: LAB_AUTH_SECRET,
  },
  stdio: 'inherit',
  shell: true,
});
child.on('exit', (code) => process.exit(code ?? 0));

const deadline = Date.now() + 180_000;
for (;;) {
  if (Date.now() > deadline) throw new Error('server lab không lên trong 180s');
  await new Promise((r) => setTimeout(r, 2000));
  try {
    if ((await fetch(`${LAB_BASE}/api/health`)).ok) break;
  } catch {
    /* chưa lên */
  }
}

// Đăng ký qua chính endpoint của better-auth để hash mật khẩu khớp với lúc đăng nhập, rồi bật
// emailVerified thẳng trong DB tạm. IDEMPOTENT — đăng ký lần hai bị TỪ CHỐI đúng thiết kế
// (`assertRegistrationOpen`), nên 4xx ở đây nghĩa là "đã seed", không phải "hỏng".
const signUp = await fetch(`${LAB_BASE}/api/auth/sign-up/email`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: LAB_BASE },
  body: JSON.stringify({ email: LAB_EMAIL, password: LAB_LOGIN, name: 'Lab Learner' }),
});
if (signUp.status >= 500) throw new Error(`sign-up lỗi: ${signUp.status} ${await signUp.text()}`);

const db = new Database(LAB_DB);
db.prepare('UPDATE user SET emailVerified = 1 WHERE email = ?').run(LAB_EMAIL);
const user = db.prepare('SELECT id FROM user WHERE email = ?').get(LAB_EMAIL);
if (!user) throw new Error('chưa seed được tài khoản lab');
db.prepare('DELETE FROM mcp_key').run();
db.prepare(
  `INSERT INTO mcp_key (id, userId, name, tokenHash, lastUsedAt, createdAt)
   VALUES ('mcpk-lab', ?, 'lab', ?, NULL, ?)`,
).run(
  user.id,
  createHash('sha256').update(LAB_MCP_TOKEN).digest('hex'),
  new Date().toISOString(),
);
db.close();

console.log(
  `\n[LAB READY] ${LAB_BASE}\n  db     ${LAB_DB}\n  login  ${LAB_EMAIL} / ${LAB_LOGIN}\n` +
    `  mcp    node tooling/lab-mcp.mjs get_stats '{}'\n`,
);
