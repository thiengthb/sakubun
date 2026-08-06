#!/usr/bin/env node
/**
 * Đo TRÙNG LẶP code, tự chứa — không cần mạng, không cần cài gì.
 *
 *   node tooling/dup-scan.mjs              báo cáo + so với mốc
 *   node tooling/dup-scan.mjs --baseline   ghim mốc hiện tại
 *   node tooling/dup-scan.mjs --list       in từng cặp file
 *
 * Vì sao KHÔNG gọi jscpd: nó phải tải qua `npx` mỗi lần chạy. Một phép đo trong harness
 * này phải chạy trên Ubuntu/macOS/Windows và không được phụ thuộc mạng (Parity Contract
 * trong AGENTS.md) — một gate chỉ xanh khi có wifi thì không phải gate.
 *
 * ĐỐI CHIẾU với `npx jscpd@4` ngày 2026-08-06, nói đúng chứ không nói cho đẹp:
 *   · TỶ LỆ KHÁC NHAU: jscpd 1.02%, cái này 3.08%. Không phải cái nào sai — mẫu số khác.
 *     jscpd đếm cả comment; ở đây comment bị loại, nên cùng số dòng trùng chia cho một mẫu
 *     số nhỏ hơn. So số của công cụ này với số của công cụ này, đừng so chéo.
 *   · THỨ TỰ các cặp lớn nhất KHỚP: items-table ↔ vocab-table áp đảo, rồi analytics ↔ stats.
 *   · Cái này tìm thêm được một cặp jscpd bỏ qua ở cấu hình đã dùng:
 *     data-table.tsx ↔ use-session-state.ts (data-table tự chứa một bản sao của cơ chế
 *     persistence). Nên "công cụ nhà làm" ở đây không phải bản rút gọn cho đủ lệ.
 *
 * Cách đo: bỏ dòng trống và dòng comment, chuẩn hoá khoảng trắng, rồi trượt một cửa sổ
 * WINDOW dòng và băm. Hai cửa sổ cùng băm = một clone. Đánh dấu từng DÒNG thuộc bất kỳ
 * cửa sổ trùng nào, nên một clone 90 dòng được tính là 90 dòng trùng — không phải 79 clone
 * chồng nhau (đó là lý do không cần logic gộp cửa sổ).
 *
 * KHÔNG ĐO (cố ý, theo /dedupe-scan):
 *   · `lib/generated/**` — generator sở hữu nó
 *   · `*.test.*` — trùng lặp trong test thường là DỄ ĐỌC, không phải nợ
 *   · `components/ui/**` — primitive vendored từ shadcn
 *
 * Và nhắc lại cảnh báo của /dedupe-scan: ĐỪNG tối ưu con số này. Câu hỏi cho từng cặp là
 * "hai chỗ này sẽ đổi CÙNG NHAU hay ĐỘC LẬP?" — độc lập thì GIỮ NGUYÊN và ghi lý do.
 * Abstraction sai tệ hơn duplication.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { repoPath, report, readJson, writeJson, stateDir } from './lib/harness.mjs';

const WINDOW = 12;                  // dòng (đã chuẩn hoá) — cùng ngưỡng đã dùng với jscpd
const ROOT = repoPath('');
const rel = (f) => relative(ROOT, f).split('\\').join('/');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

const SKIP = (r) =>
  r.startsWith('lib/generated/') ||
  r.startsWith('components/ui/') ||
  /\.test\.tsx?$/.test(r) ||
  r.endsWith('.d.ts');

const files = ['app', 'components', 'lib', 'hooks']
  .flatMap((d) => walk(repoPath(d)))
  .filter((f) => !SKIP(rel(f)));

/** Dòng có nội dung, đã chuẩn hoá khoảng trắng; comment và dòng trống bị loại. */
function significant(src) {
  const out = [];
  let inBlock = false;
  src.split('\n').forEach((raw, i) => {
    let s = raw.trim();
    if (inBlock) {
      if (s.includes('*/')) inBlock = false;
      return;
    }
    if (s.startsWith('/*')) {
      if (!s.includes('*/')) inBlock = true;
      return;
    }
    if (!s || s.startsWith('//') || s.startsWith('*')) return;
    s = s.replace(/\s+/g, ' ');
    out.push({ text: s, line: i + 1 });
  });
  return out;
}

const perFile = new Map();
for (const f of files) perFile.set(f, significant(readFileSync(f, 'utf8')));

// băm cửa sổ -> [{file, idx}]
const windows = new Map();
for (const [f, lines] of perFile) {
  for (let i = 0; i + WINDOW <= lines.length; i++) {
    const key = createHash('sha1')
      .update(lines.slice(i, i + WINDOW).map((l) => l.text).join('\n'))
      .digest('base64');
    if (!windows.has(key)) windows.set(key, []);
    windows.get(key).push({ file: f, idx: i });
  }
}

const marked = new Map();           // file -> Set(index dòng trùng)
const pairSize = new Map();         // "a|b" -> số cửa sổ trùng
const markLine = (f, i) => {
  if (!marked.has(f)) marked.set(f, new Set());
  marked.get(f).add(i);
};

for (const hits of windows.values()) {
  if (hits.length < 2) continue;
  for (const h of hits) for (let k = 0; k < WINDOW; k++) markLine(h.file, h.idx + k);
  for (let a = 0; a < hits.length; a++)
    for (let b = a + 1; b < hits.length; b++) {
      const [x, y] = [rel(hits[a].file), rel(hits[b].file)].sort();
      const key = `${x}|${y}`;
      pairSize.set(key, (pairSize.get(key) ?? 0) + 1);
    }
}

const totalLines = [...perFile.values()].reduce((n, l) => n + l.length, 0);
const dupLines = [...marked.values()].reduce((n, s) => n + s.size, 0);
const pct = totalLines ? (dupLines / totalLines) * 100 : 0;

// Số "khối" trùng = số dải liên tiếp, để một clone dài không đếm thành nhiều clone.
let blocks = 0;
for (const s of marked.values()) {
  const idx = [...s].sort((a, b) => a - b);
  for (let i = 0; i < idx.length; i++) if (i === 0 || idx[i] !== idx[i - 1] + 1) blocks++;
}

const ok = [], warn = [];
ok.push(`${files.length} file · ${totalLines} dòng có nghĩa · ${dupLines} dòng trùng (${pct.toFixed(2)}%) · ${blocks} khối`);

const pairs = [...pairSize.entries()].sort((a, b) => b[1] - a[1]);
for (const [key, n] of pairs.slice(0, process.argv.includes('--list') ? pairs.length : 5)) {
  const [a, b] = key.split('|');
  ok.push(a === b ? `${n} cửa sổ trùng TRONG ${a}` : `${n} cửa sổ trùng: ${a} ↔ ${b}`);
}
if (pairs.length > 5 && !process.argv.includes('--list'))
  ok.push(`… +${pairs.length - 5} cặp nữa (--list để xem hết)`);

const basePath = join(stateDir(), 'dup-scan-baseline.json');
const now = { at: new Date().toISOString(), pct: Number(pct.toFixed(2)), dupLines, blocks, totalLines };
if (process.argv.includes('--baseline')) {
  writeJson(basePath, now);
  ok.push(`đã ghi baseline → ${rel(basePath)}`);
} else {
  const base = readJson(basePath);
  if (!base) ok.push('chưa có baseline — chạy với --baseline. Không có mốc thì "tiến hay lùi" là CHƯA ĐO ĐƯỢC.');
  else {
    const d = (now.pct - base.pct).toFixed(2);
    const msg = `so với baseline (${base.at.slice(0, 10)}): ${base.pct}% → ${now.pct}% (${d > 0 ? '+' : ''}${d})`;
    (Number(d) > 0.1 ? warn : ok).push(msg);
  }
}

report('DUP SCAN', { ok, warn });
console.log(`  Cửa sổ ${WINDOW} dòng. ĐỪNG tối ưu con số này — hỏi từng cặp: "sẽ đổi cùng nhau hay độc lập?"
  Độc lập thì GIỮ NGUYÊN và ghi lý do vào file. Clone bỏ qua có chủ ý phải được báo RIÊNG.\n`);
