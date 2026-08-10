// Lưới gác cho `runConfigured` trong `tooling/lib/harness.mjs` — runner mà MỌI gate đi qua.
//
// VÌ SAO TEST NÀY NẰM Ở `lib/`: `vitest.config.ts` chỉ nhận `lib/**/*.test.ts`. Đặt nó ở
// `tooling/` thì `npm test` không chạy, và một lưới không chạy không gác được gì. Ở đây nó nằm
// trong gate `test` — tức chạy ở Stop hook, ở /pre-merge, và ở CI.
//
// VÌ SAO PHẢI GÁC: `tooling/lib/harness.mjs` thuộc MECHANISM_PATHS, nên `upgrade.mjs` GHI ĐÈ nó ở
// lần nâng harness sau. Bản sửa `maxBuffer` sẽ biến mất, và không có test này thì triệu chứng duy
// nhất là gate `e2e` lại lúc xanh lúc đỏ — thứ đã ngốn cả buổi để tìm ra (issue #4). Nên bản sửa
// đi kèm một test: mất bản sửa = `npm test` ĐỎ, chứ không phải một con flaky im lặng quay lại.
//
// Sự cố gốc: `spawnSync(..., { stdio: 'pipe' })` mặc định `maxBuffer` 1 MiB, và khi vượt thì Node
// KHÔNG truncate — nó giết tiến trình con (`status: null`, `error.code = 'ENOBUFS'`). Gate `e2e`
// pipe cả log `[WebServer]` của dev server nên tổng output dao động quanh đúng 1 MiB: cùng base
// `bfb19dd`, 4 lần OK và 2 lần FAIL, còn report Playwright của lần "FAIL" cho 28/28 test PASS.

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

/** MB output mà lệnh giả sẽ in ra — trên ngưỡng 1 MiB mặc định của Node, dưới mức 64 MiB đã đặt. */
const OUTPUT_MB = 2;

/**
 * Phần hợp đồng của `runConfigured` mà test này dựa vào — khai tại chỗ, có lý do.
 *
 * `tooling/lib/harness.mjs` là JS thuần và cố ý KHÔNG có `.d.ts` (nó phải chạy được với `node` trần,
 * trước cả khi install). Một `import` tĩnh vào đó làm `tsc --noEmit` đỏ TS7016 dưới `noImplicitAny`
 * — đo được, không phỏng đoán. Nên: import động qua đường dẫn dựng lúc chạy (specifier không phải
 * literal ⇒ TS không đòi declaration) cộng interface này. Đổi lại ta VIẾT RA hợp đồng đang phụ
 * thuộc, gồm hai trường `signal`/`detail` mà bản cũ không có.
 */
interface HarnessRunner {
  runConfigured(
    name: string,
    opts?: { placeholders?: Record<string, string>; capture?: boolean; cwd?: string },
  ): {
    skipped: boolean;
    status: number;
    stdout: string;
    stderr: string;
    signal?: string | null;
    detail?: string;
  };
}

let H: HarnessRunner;

/**
 * Trỏ `HARNESS_CONFIG` sang một config dựng riêng, rồi mới import module.
 *
 * `config()` cache ở mức module và đọc `HARNESS_CONFIG` ở lần gọi đầu — biến này tồn tại CHÍNH cho
 * mục đích test (xem doc của `config()`). Nhờ nó, đây là phép đo HÀNH VI của `runConfigured` với
 * lệnh thật, không phải phép kiểm chuỗi trên mã nguồn: nếu `maxBuffer` bị bỏ, ca dưới đỏ vì tiến
 * trình thật bị giết, đúng cơ chế đã cắn CI.
 */
beforeAll(async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'harness-runner-test-'));

  // Lệnh nằm trong FILE, không phải `node -e '...'`: với `shell: true` thì nháy đơn là cú pháp sh,
  // còn cmd.exe hiểu khác — bản đầu của test này XANH GIẢ trên Windows vì cmd truyền nguyên cặp
  // nháy vào node và node coi đó là string literal, không in gì. Parity contract: Ubuntu · macOS ·
  // Windows phải cho cùng kết quả, nên `path.join` + `os.tmpdir()` + đường dẫn được JSON.stringify.
  const big = path.join(dir, 'emit.cjs');
  writeFileSync(big, `process.stdout.write("x".repeat(${OUTPUT_MB} * 1024 * 1024));\n`, 'utf8');
  const failing = path.join(dir, 'exit3.cjs');
  writeFileSync(failing, 'process.stdout.write("chào"); process.exit(3);\n', 'utf8');

  const cfg = path.join(dir, 'harness.config.json');
  writeFileSync(
    cfg,
    JSON.stringify({
      commands: {
        bigoutput: `node ${JSON.stringify(big)}`,
        exits3: `node ${JSON.stringify(failing)}`,
      },
    }),
    'utf8',
  );

  process.env.HARNESS_CONFIG = cfg;
  const runnerUrl = pathToFileURL(
    path.join(import.meta.dirname, '..', 'tooling', 'lib', 'harness.mjs'),
  ).href;
  H = (await import(/* @vite-ignore */ runnerUrl)) as HarnessRunner;
});

describe('runConfigured — cái mà mọi gate đi qua', () => {
  it(`không chết vì một lệnh in ${OUTPUT_MB} MB (thiếu maxBuffer là gate lúc xanh lúc đỏ)`, () => {
    const r = H.runConfigured('bigoutput', { capture: true });

    expect(
      r.status,
      `Lệnh in ${OUTPUT_MB} MB rồi thoát 0, nhưng runConfigured báo lỗi. Gần như chắc chắn ` +
        '`maxBuffer` đã bị bỏ khỏi spawnSync: Node mặc định 1 MiB và GIẾT tiến trình con khi vượt, ' +
        'nên mọi gate in nhiều log (e2e) sẽ đỏ ngẫu nhiên. Xem issue #4.',
    ).toBe(0);
    expect(r.stdout.length, 'output phải về trọn vẹn, không bị cắt').toBe(OUTPUT_MB * 1024 * 1024);
    expect(r.skipped).toBe(false);
  });

  it('mã thoát thật được giữ nguyên, và lệnh chưa khai vẫn là "bỏ qua"', () => {
    // Hai ca này chốt rằng ca trên đang đo đúng thứ: `HARNESS_CONFIG` có tác dụng, và bản sửa
    // không làm hỏng đường đi bình thường. Không có chúng, một `runConfigured` luôn trả 0 vì lý
    // do nào đó cũng sẽ làm ca trên xanh — tức lưới gác giả.
    const failed = H.runConfigured('exits3', { capture: true });
    expect(failed.status, 'exit 3 phải về đúng 3, không bị làm tròn thành 1').toBe(3);
    expect(failed.stdout).toContain('chào');

    const missing = H.runConfigured('khong-he-khai-bao', { capture: true });
    expect(missing.skipped, 'lệnh chưa khai = bỏ qua, đây là hành vi cố ý của harness').toBe(true);
  });

  it('tiến trình không thoát bình thường được báo là sự cố hạ tầng, không phải gate đỏ', () => {
    // Phép kiểm trên MÃ NGUỒN, và đây là chỗ DUY NHẤT phải làm vậy — có lý do: để `status` thành
    // `null` một cách chủ động thì phải giết tiến trình bằng signal, mà Windows không có signal,
    // nên một ca hành vi sẽ hoặc chỉ chạy trên POSIX (vi phạm parity contract) hoặc phải in hơn
    // 64 MiB để chạm ENOBUFS (chậm và nặng vô ích). Kiểm nguồn là dạng rẻ nhất còn lại, và nó vẫn
    // bắt đúng thứ cần bắt: nhánh xử lý biến mất sau một lần upgrade.
    const src = readFileSync(
      path.join(import.meta.dirname, '..', 'tooling', 'lib', 'harness.mjs'),
      'utf8',
    );
    const start = src.indexOf('export function runConfigured');
    expect(start, 'không tìm thấy runConfigured — file harness đã đổi hình dạng').toBeGreaterThan(-1);
    const next = src.indexOf('\nexport ', start + 1);
    const body = src.slice(start, next === -1 ? undefined : next);

    expect(
      /status:\s*r\.status\s*\?\?\s*1/.test(body),
      'runConfigured lại gộp `r.status ?? 1`. Một tiến trình bị signal-kill (buffer, OOM, timeout) ' +
        'sẽ được báo y như lệnh trả mã lỗi, và người đọc CI đi tìm bug ở chỗ không có gì sai.',
    ).toBe(false);
    expect(
      /r\.status\s*===\s*null/.test(body),
      'runConfigured phải xử lý riêng `r.status === null`.',
    ).toBe(true);
    expect(body, 'và phải nói ra `signal` trong trường hợp đó').toMatch(/r\.signal/);
  });
});
