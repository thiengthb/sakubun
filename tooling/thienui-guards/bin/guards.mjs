#!/usr/bin/env node
/**
 * thienui-guards — chạy mọi cổng UI trên một repo.
 *
 * Đặt vào `verify` của project tiêu thụ:
 *   "verify": "... && thienui-guards"
 *
 * Cờ:
 *   --root <đường dẫn>      repo cần quét (mặc định: cwd)
 *   --tokens <file.json>    tokens.json đã build (mặc định: tự tìm trong node_modules hoặc workspace)
 *   --patterns <file.json>  registry luật (mặc định: tự tìm)
 *   --report                in đủ bảng đo, kể cả ca đã pass
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { checkContrast, checkGamut } from '../src/contrast.mjs';
import { runPatternLock } from '../src/pattern-lock.mjs';
import { checkCanonicals } from '../src/canonical.mjs';

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf('--' + n);
  return i === -1 ? d : argv[i + 1];
};
const has = (n) => argv.includes('--' + n);

const root = resolve(flag('root', process.cwd()));

/** Tự tìm một file ở các chỗ thường gặp: node_modules (project tiêu thụ) hoặc workspace (trong repo). */
function locate(explicit, candidates, what) {
  if (explicit) {
    const p = resolve(explicit);
    if (!existsSync(p)) fail(`không thấy ${what}: ${p}`);
    return p;
  }
  for (const c of candidates) {
    const p = resolve(root, c);
    if (existsSync(p)) return p;
  }
  fail(`không tự tìm được ${what}. Truyền đường dẫn bằng cờ tương ứng.\n  đã thử:\n` + candidates.map((c) => '    ' + c).join('\n'));
}

function fail(msg) {
  console.error('\n✗ thienui-guards: ' + msg + '\n');
  process.exit(2);
}

const tokensPath = locate(flag('tokens'), [
  'node_modules/@thienui/tokens/dist/tokens.json',
  'tooling/thienui-guards/tokens.json',
  'packages/tokens/dist/tokens.json',
  '../tokens/dist/tokens.json',
], 'tokens.json');

const patternsPath = locate(flag('patterns'), [
  'node_modules/@thienui/ui-patterns/src/ui-patterns.json',
  'tooling/thienui-guards/ui-patterns.json',
  'packages/ui-patterns/src/ui-patterns.json',
  '../ui-patterns/src/ui-patterns.json',
  'docs/ui-patterns.json',
], 'ui-patterns.json');

/**
 * Luật là của chính repo này (thienui), hay ĐƯỢC PHÁT tới project tiêu thụ — qua node_modules (npm)
 * hoặc qua `tooling/thienui-guards/` (registry item `guards` chép vào)?
 */
const parts = patternsPath.split(/[\\/]/);
const ownsRegistry = !parts.includes('node_modules') && !parts.includes('thienui-guards');

const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'));
const registry = JSON.parse(readFileSync(patternsPath, 'utf8'));

let exitCode = 0;
const bar = '─'.repeat(72);

/* ───────── cổng 1: gamut ───────── */
const gamut = checkGamut(tokens);
if (!gamut.pass) {
  exitCode = 1;
  console.error('\n' + bar + '\n✗ GAMUT — token khai màu ngoài sRGB, máy không hiện được đúng màu đó\n' + bar);
  for (const b of gamut.outOfGamut) console.error(`  ${b.path}  ${b.value}`);
}

/* ───────── cổng 2: contrast ───────── */
const c = checkContrast(tokens);
const byTier = (t) => c.results.filter((r) => r.tier === t).length;
if (!c.pass) {
  exitCode = 1;
  console.error('\n' + bar + '\n✗ CONTRAST — ' + c.failures.length + '/' + c.results.length + ' cặp trượt sàn WCAG\n' + bar);
  for (const f of c.failures) {
    console.error(`  ${f.theme}/${f.mode}  --${f.fg} trên --${f.bg}`);
    console.error(`      đo ${f.ratio} · cần ${f.floor} · ${f.where}`);
    if (f.reason) console.error(`      ${f.reason}`);
  }
  console.error('\n  Sửa TOKEN, đừng chuyển một cặp chữ xuống bậc đồ hoạ cho cổng im tiếng.');
  console.error('  Dùng solveLightness() trong @thienui/guards để giải L thay vì mò bằng tay.');
}

/* ───────── cổng 3: pattern lock ───────── */
const pl = runPatternLock(root, registry);
if (!pl.pass) {
  exitCode = 1;
  console.error('\n' + bar + '\n✗ UI PATTERN LOCK — ' + pl.total + ' vi phạm luật đã khoá\n' + bar);
  for (const p of pl.byPattern) {
    if (!p.violations.length) continue;
    console.error(`\n  [${p.id}]  ${p.rule}`);
    if (p.canonical) console.error(`  làm đúng ở: ${p.canonical}${ownsRegistry ? '' : '  (trong repo thienui)'}`);
    for (const v of p.violations.slice(0, 8)) console.error(`    ${v.file}:${v.line}  ${v.excerpt}`);
    if (p.violations.length > 8) console.error(`    … và ${p.violations.length - 8} chỗ nữa`);
  }
}
for (const p of pl.byPattern) {
  if (p.error) {
    exitCode = 1;
    console.error(`\n✗ luật [${p.id}] lỗi cấu hình: ${p.error}`);
  }
}

/* ───────── cổng 4: canonical phải có thật ───────── */
// Cổng này kiểm REGISTRY LUẬT, không kiểm repo đang quét: `canonical` là đường dẫn bên trong thienui.
// Ở project tiêu thụ (luật đến từ node_modules hoặc tooling/thienui-guards/) mọi con trỏ đều "không tồn tại" theo định nghĩa, và
// một cổng đỏ vì lý do người tiêu thụ không sửa được sẽ dạy họ tắt cổng. Registry được kiểm ở CI
// của chính thienui; ở đây `canonical` chỉ in ra như con trỏ vào mã nguồn thienui.
const can = ownsRegistry ? checkCanonicals(root, registry) : { pass: true, skipped: true };
if (!can.pass) {
  exitCode = 1;
  console.error('\n' + bar + '\n✗ CANONICAL — luật trỏ "làm đúng ở" vào chỗ không tồn tại\n' + bar);
  for (const m of can.missing) console.error(`  [${m.id}]  ->  ${m.canonical}`);
  for (const id of can.noCanonical) console.error(`  [${id}]  thiếu hẳn trường canonical (dùng "—" nếu cố ý)`);
  console.error('\n  Một luật trỏ vào file không có thì tệ hơn một luật không có con trỏ: người đọc mở ra,');
  console.error('  không thấy gì, rồi kết luận luật đã lỗi thời và bỏ qua nó.');
}

/* ───────── tổng kết ───────── */
const manual = pl.byPattern.filter((p) => p.manual).length;
const auto = pl.byPattern.length - manual;
if (has('report')) {
  console.log('\n' + bar + '\nBẢNG ĐO CONTRAST\n' + bar);
  let last = '';
  for (const r of c.results) {
    const k = `${r.theme}/${r.mode}`;
    if (k !== last) { console.log(`\n  ${k}`); last = k; }
    const mark = r.pass ? '·' : '✗';
    const floor = r.floor ? `/ cần ${r.floor}` : '/ bậc decor, không có sàn';
    console.log(`    ${mark} --${r.fg} trên --${r.bg}  ${String(r.ratio).padEnd(7)} ${floor}`);
  }
}
if (exitCode === 0) {
  console.log(
    `✓ guards: ${c.results.length} cặp contrast (${byTier('text')} chữ · ${byTier('graphic')} đồ hoạ · ${byTier('decor')} decor) ` +
      `· ${auto} luật máy kiểm + ${manual} luật review · gamut sạch · ${can.skipped ? 'canonical: kiểm ở thienui' : 'canonical đủ'}`
  );
} else {
  console.error('');
}
process.exit(exitCode);
