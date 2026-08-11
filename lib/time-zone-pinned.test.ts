import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_TIME_ZONE, formatDateVN } from './format';

/**
 * Mọi chỗ format ngày/giờ phải GHIM `timeZone`.
 *
 * `lib/format.ts` đã nói vì sao và làm đúng từ đầu: `vi-VN` đặt NGÔN NGỮ, không đặt múi giờ, nên thiếu
 * `timeZone` thì chuỗi phụ thuộc múi giờ của tiến trình đang chạy — và ở một app SSR thì có HAI tiến
 * trình. Server lệch múi giờ với trình duyệt cho ra ngày khác nhau quanh nửa đêm: một hydration mismatch
 * chỉ xảy ra vài giờ mỗi ngày, tức loại lỗi khó nhất để tin là mình đã sửa.
 *
 * Vì sao là test chứ không phải một dòng trong AGENTS.md: luật này ĐÃ được viết ra ngay trong docstring
 * của `APP_TIME_ZONE`, và vẫn có hai chỗ tự format ngày mà không ghim (`learner-profile.tsx`,
 * `settings-account-tab.tsx`) — chúng vào repo sau khi luật đã tồn tại. Lời nhắc không chặn được ai đang
 * gấp; phép kiểm thì chặn.
 *
 * Đo 2026-08-12: container production đang chạy `TZ=Asia/Ho_Chi_Minh`, nên hai chỗ đó CHƯA gây lỗi thật.
 * Đó chính là lý do phải gác: cái giữ cho nó đúng là một biến môi trường trong compose, không phải code,
 * và một lần deploy ở chỗ khác là đủ để nó sai — im lặng.
 */

const ROOTS = ['app', 'components', 'lib', 'mobile'];
const SKIP_DIRS = new Set(['node_modules', 'generated', '.next', '.expo']);
// File này necessarily NHẮC TÊN các API nó gác, nên bỏ nó ra khỏi lượt quét.
const SKIP_FILES = new Set(['lib/time-zone-pinned.test.ts']);

// `toLocaleTimeString` cũng vào danh sách: giờ trong ngày lệch 7 tiếng là sai rõ hơn cả ngày lệch.
const FORMATTERS = /\.toLocale(?:Date|Time)?String\(|new Intl\.DateTimeFormat\(/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('mọi chỗ format ngày/giờ đều ghim múi giờ', () => {
  it('không có toLocale*/Intl.DateTimeFormat nào thiếu timeZone', () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const rel = relative(process.cwd(), file).split(sep).join('/');
        if (SKIP_FILES.has(rel)) continue;
        const src = readFileSync(file, 'utf8');
        const lines = src.split('\n');
        lines.forEach((line, i) => {
          if (!FORMATTERS.test(line)) return;
          // Lời gọi thường trải nhiều dòng (object options xuống dòng), nên soi một CỬA SỔ từ chỗ khớp
          // thay vì chỉ dòng đó. 12 dòng phủ mọi lời gọi hiện có trong repo với dư ra nhiều.
          const window = lines.slice(i, i + 12).join('\n');
          if (!window.includes('timeZone')) {
            offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 90)}`);
          }
        });
      }
    }
    expect(
      offenders,
      `Thiếu timeZone (dùng hàm trong lib/format.ts, hoặc ghim timeZone: APP_TIME_ZONE):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  // Phép kiểm đi kèm: chứng minh việc ghim CÓ TÁC DỤNG, chứ không chỉ có mặt chữ `timeZone`.
  //
  // Cách hiển nhiên — đổi `process.env.TZ` rồi so hai lần format — KHÔNG dùng được, và tôi đã viết nó ra
  // trước khi đo: Node cache múi giờ mặc định của `Intl`, nên đổi biến giữa tiến trình không có tác dụng
  // (đo 2026-08-12: `toLocaleDateString` KHÔNG ghim vẫn cho "11/8/2026" ở cả UTC lẫn Los_Angeles). Một
  // test viết theo cách đó sẽ xanh kể cả khi bỏ hết `timeZone` — tức nó khoá đúng con bug nó tưởng đang
  // gác. Nên so trực tiếp hai múi giờ ĐƯỢC GHIM TƯỜNG MINH.
  //
  // 17:30Z ngày 11/8 là 00:30 ngày 12/8 ở +07 — đúng cái khoảng 7 tiếng mỗi ngày mà một tiến trình chạy
  // giờ UTC sẽ in ra ngày hôm trước.
  it('mốc quanh nửa đêm: ghim +07 cho ngày khác với ghim UTC', () => {
    const boundary = new Date('2026-08-11T17:30:00.000Z');
    const inZone = (timeZone: string) =>
      new Intl.DateTimeFormat('vi-VN', { timeZone }).format(boundary);

    expect(APP_TIME_ZONE).toBe('Asia/Ho_Chi_Minh');
    expect(formatDateVN(boundary)).toBe(inZone(APP_TIME_ZONE));
    expect(formatDateVN(boundary)).toContain('12'); // ngày 12 theo giờ Việt Nam
    expect(inZone('UTC')).toContain('11'); // …và 11 nếu tiến trình chạy giờ UTC
    expect(formatDateVN(boundary)).not.toBe(inZone('UTC'));
  });
});
