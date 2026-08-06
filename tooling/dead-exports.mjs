#!/usr/bin/env node
/**
 * Tìm export KHÔNG AI DÙNG, bằng TypeScript compiler API — không phải grep.
 *
 *   node tooling/dead-exports.mjs              báo cáo
 *   node tooling/dead-exports.mjs --baseline   ghim mốc hiện tại
 *
 * Vì sao không grep: một cái tên như `Field` hay `Group` xuất hiện khắp nơi vì lý do
 * không liên quan, nên grep vừa bỏ sót vừa tố giác bừa. Ở đây câu hỏi là về ĐỒ THỊ MODULE:
 * "có file nào import tên này từ file kia không?", và chỉ compiler trả lời được.
 *
 * Hai lượt:
 *   1. mỗi file có những export nào (`checker.getExportsOfModule`)
 *   2. mỗi file import những tên nào, TỪ file nào (resolve `@/…` và `./…` về file thật)
 * Export "chết" = không file nào khác import tên đó từ file đó.
 *
 * BẪY ĐÃ TRẢ GIÁ (2026-08-06): `path.resolve` trên Windows trả `\`, còn TypeScript đánh
 * index SourceFile bằng `/`, và `getSourceFile()` là một phép tra map thuần. Không chuẩn hoá
 * thì MỌI phép tra đều trượt và bản báo cáo đầu tiên nói CẢ REPO là code chết — gồm cả những
 * thứ chắc chắn đang dùng. Nếu tin con số đó thì đã xoá nửa repo. Xem `norm()` bên dưới.
 *
 * GIỚI HẠN, nói ra để không ai tin quá mức:
 *   · `export *` và `import * as` → coi như dùng HẾT (không kết luận được, chọn hướng im lặng)
 *   · dynamic import với đường dẫn tính toán → bỏ sót
 *   · entry point của framework (default export của page, `metadata`, `GET`/`POST`…) không
 *     bao giờ được import → đã lọc ra, xem NEXT_ENTRY
 *   · `components/ui/**` bị BỎ QUA: đó là bề mặt primitive vendored từ shadcn/Radix, thiếu
 *     một nửa mới là lỗi. Cùng lý lẽ với "không dedupe generated code" trong /dedupe-scan.
 */
import { createRequire } from 'node:module';
import { relative, resolve, dirname, join } from 'node:path';
import { repoPath, report, readJson, writeJson, stateDir } from './lib/harness.mjs';

const require_ = createRequire(join(repoPath(''), 'package.json'));
let ts;
try {
  ts = require_('typescript');
} catch {
  console.log('\n=== DEAD EXPORTS ===\n  ?    không tìm thấy `typescript` — chạy `npm ci` trước.\n');
  process.exit(0);
}

const ROOT = repoPath('');
const norm = (p) => p.split('\\').join('/');
const rel = (f) => relative(ROOT, f).split('\\').join('/');

const cfgPath = ts.findConfigFile(ROOT, ts.sys.fileExists, 'tsconfig.json');
const cfg = ts.parseJsonConfigFileContent(
  ts.readConfigFile(cfgPath, ts.sys.readFile).config,
  ts.sys,
  ROOT,
);
const program = ts.createProgram(cfg.fileNames, cfg.options);
const checker = program.getTypeChecker();

// Vùng CÓ CHỦ: nơi một export chết là nợ. `components/ui` và generated không nằm trong đây.
const OWNED = ['app/', 'components/', 'lib/', 'hooks/', 'e2e/'];
const isOwned = (f) => {
  const r = rel(f);
  return (
    !f.includes('node_modules') &&
    !r.startsWith('lib/generated/') &&
    !r.startsWith('components/ui/') &&
    !f.endsWith('.d.ts') &&
    OWNED.some((o) => r.startsWith(o))
  );
};

const NEXT_ENTRY = new Set([
  'default', 'metadata', 'generateMetadata', 'viewport', 'dynamic', 'runtime', 'revalidate',
  'maxDuration', 'generateStaticParams', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD',
]);

const exportsOf = new Map();
const importedFrom = new Map();
const add = (m, k, v) => {
  if (!m.has(k)) m.set(k, new Set());
  m.get(k).add(v);
};

for (const sf of program.getSourceFiles()) {
  // Lượt 2 phải chạy cho MỌI file của repo (kể cả components/ui và test), vì một file không
  // "có chủ" vẫn là NGƯỜI DÙNG hợp lệ của file có chủ. Chỉ lượt 1 mới giới hạn vùng.
  const ours = !sf.fileName.includes('node_modules') && !sf.fileName.endsWith('.d.ts');
  if (!ours) continue;

  if (isOwned(sf.fileName)) {
    const sym = checker.getSymbolAtLocation(sf);
    if (sym) for (const e of checker.getExportsOfModule(sym)) add(exportsOf, sf.fileName, e.getName());
  }

  const noteImport = (spec, names) => {
    const text = spec.text;
    let target = null;
    if (text.startsWith('@/')) target = resolve(ROOT, text.slice(2));
    else if (text.startsWith('.')) target = resolve(dirname(sf.fileName), text);
    else return;
    target = norm(target);
    for (const cand of [target + '.ts', target + '.tsx', target + '/index.ts', target + '/index.tsx']) {
      if (program.getSourceFile(cand)) {
        for (const n of names) add(importedFrom, cand, n);
        return;
      }
    }
  };

  ts.forEachChild(sf, (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const names = [];
      const c = node.importClause;
      if (c?.name) names.push('default');
      if (c?.namedBindings) {
        if (ts.isNamedImports(c.namedBindings))
          for (const el of c.namedBindings.elements) names.push((el.propertyName ?? el.name).text);
        else names.push('*');
      }
      noteImport(node.moduleSpecifier, names);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const names = [];
      if (node.exportClause && ts.isNamedExports(node.exportClause))
        for (const el of node.exportClause.elements) names.push((el.propertyName ?? el.name).text);
      else names.push('*');
      noteImport(node.moduleSpecifier, names);
    }
  });
}

const orphanFiles = [];   // không file nào import — ứng viên xoá cả file
const looseExports = [];  // file vẫn dùng, nhưng có tên không ai lấy — ứng viên bỏ `export`
for (const [file, names] of exportsOf) {
  const used = importedFrom.get(file) ?? new Set();
  if (used.has('*')) continue;
  const dead = [...names].filter((n) => !used.has(n) && !NEXT_ENTRY.has(n));
  if (!dead.length) continue;
  const r = rel(file);
  // Một file trong `app/` không có ai import là BÌNH THƯỜNG — router gọi nó.
  if (used.size === 0 && !r.startsWith('app/')) orphanFiles.push({ file: r, dead });
  else looseExports.push({ file: r, dead });
}

const ok = [], warn = [], fail = [];
for (const o of orphanFiles.sort((a, b) => a.file.localeCompare(b.file)))
  fail.push(`${o.file}: KHÔNG file nào import — cả file là ứng viên xoá (${o.dead.join(', ')})`);

const looseCount = looseExports.reduce((n, r) => n + r.dead.length, 0);
if (looseCount) {
  warn.push(`${looseCount} export chỉ dùng TRONG chính file nó, ở ${looseExports.length} file — `
    + `bỏ chữ \`export\`, giữ code. Chạy với --list để xem hết.`);
}
if (!orphanFiles.length && !looseCount) ok.push('không có export chết nào');

if (process.argv.includes('--list')) {
  for (const r of looseExports.sort((a, b) => b.dead.length - a.dead.length))
    ok.push(`${r.file} → ${r.dead.join(', ')}`);
}

// Mốc: chỉ để trả lời "đang tiến hay lùi", không phải để chặn.
const basePath = join(stateDir(), 'dead-exports-baseline.json');
const now = { at: new Date().toISOString(), orphanFiles: orphanFiles.length, looseExports: looseCount };
if (process.argv.includes('--baseline')) {
  writeJson(basePath, now);
  ok.push(`đã ghi baseline → ${rel(basePath)}`);
} else {
  const base = readJson(basePath);
  if (!base) ok.push('chưa có baseline — chạy với --baseline. Không có mốc thì "tiến hay lùi" là CHƯA ĐO ĐƯỢC.');
  else {
    const d = (k) => now[k] - base[k];
    const parts = ['orphanFiles', 'looseExports'].map((k) => `${k} ${d(k) > 0 ? '+' : ''}${d(k)}`);
    (d('orphanFiles') > 0 || d('looseExports') > 0 ? warn : ok).push(
      `so với baseline (${base.at.slice(0, 10)}): ${parts.join(', ')}`);
  }
}

const good = report('DEAD EXPORTS', { ok, warn, fail });
console.log('  Export chết KHÔNG tự động là rác: kiểm từng cái trước khi xoá (xem GIỚI HẠN ở đầu file).\n');
process.exit(good ? 0 : 1);
