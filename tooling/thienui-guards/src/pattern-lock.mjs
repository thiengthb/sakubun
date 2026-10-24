/**
 * Bộ chạy cho LUẬT UI ĐÃ KHOÁ.
 *
 * Ý tưởng gốc từ `docs/ui-patterns.json` + `lib/ui-pattern-lock.test.ts` của sakubun, và nó là tài sản
 * thật của repo đó: một registry chỉ-thêm (append-only) các luật UI mà người dùng KHÔNG BAO GIỜ phải
 * nhắc lại. Mỗi luật mang `rule` (luật là gì) · `why` (vì sao — để sau này không ai gỡ nó vì tưởng vô
 * nghĩa) · `canonical` (chỗ làm đúng, để copy) · `check` (máy chạy được) · `allow` (ngoại lệ KÈM LÝ DO).
 *
 * Hai bên đọc cùng một file: bộ chạy này làm đỏ `pnpm test`, và một hook hiện toàn bộ luật trước lần
 * ghi UI đầu tiên của mỗi phiên. Một luật chỉ có chữ thì là một lời nhắc; có `check` thì là một cổng.
 */
import { readFileSync, globSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const DEFAULT_SCOPE = ['**/*.tsx', '**/*.ts', '**/*.jsx', '**/*.js', '**/*.css'];
const IGNORE = ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.turbo/**', '**/*.d.ts'];
/**
 * Thư mục KHÔNG BAO GIỜ đi vào. `IGNORE` lọc từng file SAU khi glob đã duyệt cả cây; ở một app Next có
 * `node_modules` và `.next` thì phần duyệt đó chiếm gần hết thời gian (đo trên sakubun: 46 giây cho
 * một lượt, 1 giây khi cắt nhánh). Cắt ở đây là để cổng đủ nhanh để chạy trong `npm test`.
 */
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo', '.git']);
const skipDir = (p) => SKIP_DIRS.has(basename(typeof p === 'string' ? p : p.name));

/**
 * Khớp glob tối giản cho danh sách loại trừ.
 *
 * `**\/` phải khớp KHÔNG đoạn nào luôn, không chỉ một-hoặc-nhiều: `**\/node_modules/**` phải bắt được
 * `node_modules/pkg/a.tsx` (nằm ngay gốc repo), không chỉ `a/node_modules/pkg/a.tsx`. Dịch nó thành
 * `.*\/` sẽ đòi một dấu gạch đứng trước và bỏ sót đúng trường hợp phổ biến nhất.
 */
function matchSimple(pattern, path) {
  let rx = '';
  let i = 0;
  while (i < pattern.length) {
    if (pattern.startsWith('**/', i)) { rx += '(?:[^/]+/)*'; i += 3; }
    else if (pattern.startsWith('**', i)) { rx += '.*'; i += 2; }
    else if (pattern[i] === '*') { rx += '[^/]*'; i += 1; }
    else { rx += pattern[i].replace(/[.+^${}()|[\]\\?]/, '\\$&'); i += 1; }
  }
  return new RegExp('^' + rx + '$').test(path);
}

/**
 * `exclude` tồn tại vì glob không diễn tả được "mọi nơi TRỪ một thư mục" — và đó là phạm vi đúng của
 * phần lớn luật văn phong: chúng áp cho code TA VIẾT, không áp cho code vendor được kéo lại từ
 * upstream. Không có nó thì mỗi luật phải liệt kê tay từng thư mục được phép, và lần thêm thư mục
 * thứ tư là lần một luật âm thầm ngừng áp.
 */
function filesFor(root, scope, exclude = []) {
  const out = new Set();
  for (const pat of scope) {
    for (const f of globSync(pat, { cwd: root, exclude: skipDir })) {
      if (IGNORE.some((i) => matchSimple(i, f))) continue;
      if (exclude.some((e) => matchSimple(e, f))) continue;
      out.add(f);
    }
  }
  return [...out].sort();
}

/**
 * Tìm chỗ kết thúc của thẻ JSX mở bắt đầu ở `start` (vị trí của `<`). Trả về `{ end, selfClosing }`.
 *
 * Phải đi qua ngoặc nhọn và chuỗi chứ không tìm `>` đầu tiên: `onClick={() => x}` chứa một `>` nằm
 * TRONG thuộc tính, và tìm ngây thơ sẽ cắt thẻ ở đó rồi đọc nhầm phần còn lại là con của nó.
 */
function tagEnd(text, start) {
  let depth = 0;
  let quote = null;
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return { end: i, selfClosing: text[i - 1] === '/' };
  }
  return { end: text.length - 1, selfClosing: true };
}

/** Tên được import từ một module — gồm cả bí danh: `import { Image as ImageIcon }` cho `ImageIcon`. */
function importedNames(text, from) {
  const names = new Set();
  const rx = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${from.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}['"]`, 'g');
  for (const m of text.matchAll(rx)) {
    for (const part of m[1].split(',')) {
      const p = part.trim();
      if (!p || p.startsWith('type ')) continue;
      const alias = p.split(/\s+as\s+/).pop().trim();
      if (/^[A-Z]\w*$/.test(alias)) names.add(alias);
    }
  }
  return names;
}

/**
 * Tách token class ra khỏi văn bản của một thẻ, rồi bỏ tiền tố biến thể (`md:`, `[&_svg]:`,
 * `data-[state=open]:`). Bỏ tới dấu `:` CUỐI nằm ngoài ngoặc vuông — `[&_svg]:size-4` phải ra `size-4`,
 * còn `size-[var(--a)]` thì giữ nguyên.
 */
function classTokens(tagText) {
  const out = [];
  for (const raw of tagText.split(/[\s"'`{}(),]+/)) {
    if (!raw) continue;
    let depth = 0;
    let cut = -1;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '[') depth++;
      else if (raw[i] === ']') depth--;
      else if (raw[i] === ':' && depth === 0) cut = i;
    }
    out.push(raw.slice(cut + 1));
  }
  return out;
}

/**
 * Một `<Tên` chỉ là thẻ JSX khi KHÔNG đứng ngay sau một định danh: `useState<Item>()` và `Array<Badge>`
 * là generic của TypeScript, và đếm chúng là thẻ mở sẽ khiến mọi icon phía sau bị coi là nằm trong
 * `Item` hay `Badge`.
 */
const JSX_OPEN = (name) => new RegExp(`(?<![\\w.$\\]])<(${name})(?=[\\s/>])`, 'g');

/**
 * Bộ chạy cho luật về CLASS TRÊN MỘT LOẠI THẺ JSX — thứ regex theo dòng không diễn tả được, vì icon
 * lucide được import với tên trần (`Search`, `X`) và một thẻ JSX hay trải trên nhiều dòng.
 *
 *   tags        — tên thẻ cụ thể, ví dụ `["Button"]`
 *   tagsFrom    — module mà MỌI tên import từ nó đều là thẻ cần kiểm, ví dụ `"lucide-react"`
 *   tagSuffix   — tên kết thúc bằng hậu tố này cũng là thẻ cần kiểm (`Icon` bắt `<item.icon>` đã gán
 *                 vào biến `Icon`, và `<ImageIcon>`)
 *   forbidClass — regex cho token class bị cấm (đã bỏ tiền tố biến thể)
 *   allowClass  — regex cho token class được miễn dù khớp `forbidClass`
 *   inside      — nếu có: chỉ tính khi thẻ nằm TRONG một trong các thẻ cha này
 */
function checkJsxClass(text, chk) {
  const names = new Set(chk.tags ?? []);
  if (chk.tagsFrom) for (const n of importedNames(text, chk.tagsFrom)) names.add(n);
  const isTag = (n) => names.has(n) || (chk.tagSuffix && n.endsWith(chk.tagSuffix));
  const forbid = new RegExp(chk.forbidClass);
  const allow = chk.allowClass ? new RegExp(chk.allowClass) : null;
  const found = [];
  for (const m of text.matchAll(JSX_OPEN('[A-Z]\\w*'))) {
    if (!isTag(m[1])) continue;
    const { end } = tagEnd(text, m.index);
    const tagText = text.slice(m.index + m[0].length, end);
    const bad = classTokens(tagText).filter((t) => forbid.test(t) && !(allow && allow.test(t)));
    if (!bad.length) continue;
    if (chk.inside && !chk.inside.some((p) => openCount(text, p, m.index) > 0)) continue;
    found.push({ index: m.index, classes: bad, tag: m[1] });
  }
  return found;
}

/** Số thẻ `<parent>` còn mở tại vị trí `at` — thẻ tự đóng `<Button />` không chứa được con nên không tính. */
function openCount(text, parent, at) {
  const before = text.slice(0, at);
  let open = 0;
  for (const m of before.matchAll(JSX_OPEN(parent))) {
    if (!tagEnd(before, m.index).selfClosing) open++;
  }
  const closed = before.match(new RegExp(`</${parent}\\s*>`, 'g'))?.length ?? 0;
  return open - closed;
}

/**
 * Chạy một luật. Trả về danh sách vi phạm `{file, line, excerpt}`.
 *
 * `check.kind`:
 *   forbid        — `pattern` KHÔNG được xuất hiện trong phạm vi
 *   require       — `pattern` PHẢI xuất hiện trong mỗi file thuộc phạm vi
 *   forbid-import — file trong `check.from` không được import đường dẫn khớp `check.pattern`
 *   require-with  — file khớp `when` thì phải khớp cả `then`
 *   jsx-class     — thẻ JSX được chọn không được mang token class bị cấm (xem `checkJsxClass`)
 *
 * `check.exclude` bỏ qua một số glob trong phạm vi — dùng để loại code vendor khỏi luật văn phong.
 */
export function runCheck(root, pattern) {
  const chk = pattern.check;
  if (!chk) return { skipped: 'luật chỉ có chữ, không có check máy chạy được', violations: [] };
  const scope = chk.files ?? DEFAULT_SCOPE;
  const exclude = chk.exclude ?? [];
  const allow = pattern.allow ?? {};
  // Khoá của `allow` là đường dẫn HOẶC glob. Glob cần thiết vì cùng một file sống ở
  // `apps/docs/registry/...` trong thienui nhưng ở `apps/web/registry/...` trong project tiêu thụ —
  // ghi cứng `apps/docs/` thì ngoại lệ không bao giờ khớp ở nơi nó được dùng thật.
  const allowed = (f) => f in allow || Object.keys(allow).some((k) => k.includes('*') && matchSimple(k, f));
  const violations = [];

  if (chk.kind === 'forbid' || chk.kind === 'forbid-import') {
    const rx = new RegExp(chk.pattern);
    const files = filesFor(root, chk.kind === 'forbid-import' ? (chk.from ?? scope) : scope, exclude);
    for (const f of files) {
      if (allowed(f)) continue;
      const lines = readFileSync(resolve(root, f), 'utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (rx.test(lines[i])) violations.push({ file: f, line: i + 1, excerpt: lines[i].trim().slice(0, 120) });
      }
    }
  } else if (chk.kind === 'require') {
    const rx = new RegExp(chk.pattern);
    for (const f of filesFor(root, scope, exclude)) {
      if (allowed(f)) continue;
      if (!rx.test(readFileSync(resolve(root, f), 'utf8'))) {
        violations.push({ file: f, line: 0, excerpt: 'thiếu mẫu: ' + chk.pattern });
      }
    }
  } else if (chk.kind === 'require-with') {
    // Nếu `when` khớp trong một file thì `then` cũng phải khớp trong file đó.
    const when = new RegExp(chk.when);
    const then = new RegExp(chk.then);
    for (const f of filesFor(root, scope, exclude)) {
      if (allowed(f)) continue;
      const text = readFileSync(resolve(root, f), 'utf8');
      if (when.test(text) && !then.test(text)) {
        violations.push({ file: f, line: 0, excerpt: 'khớp "' + chk.when + '" nhưng thiếu "' + chk.then + '"' });
      }
    }
  } else if (chk.kind === 'jsx-class') {
    for (const f of filesFor(root, chk.files ?? ['**/*.tsx', '**/*.jsx'], exclude)) {
      if (allowed(f)) continue;
      const text = readFileSync(resolve(root, f), 'utf8');
      for (const v of checkJsxClass(text, chk)) {
        const line = text.slice(0, v.index).split('\n').length;
        violations.push({ file: f, line, excerpt: `<${v.tag}> mang ${v.classes.join(' ')}` });
      }
    }
  } else if (chk.kind === 'manual') {
    // Luật người review, không máy. Vẫn nằm trong registry vì hook phải HIỆN nó ra trước khi ghi UI —
    // và vì `why` của nó là thứ ngăn người sau gỡ luật vì tưởng nó vô nghĩa.
    return { manual: true, violations: [] };
  } else {
    return { error: 'check.kind không biết: ' + chk.kind, violations: [] };
  }
  return { violations };
}

/** Chạy cả registry. Trả về { pass, byPattern, total }. */
export function runPatternLock(root, registry) {
  const byPattern = [];
  let total = 0;
  for (const p of registry.patterns) {
    const r = runCheck(root, p);
    total += r.violations.length;
    byPattern.push({ id: p.id, rule: p.rule, canonical: p.canonical, ...r });
  }
  return { pass: total === 0, byPattern, total };
}

export const loadRegistry = (file) => JSON.parse(readFileSync(file, 'utf8'));
