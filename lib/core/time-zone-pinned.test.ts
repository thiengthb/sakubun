import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_TIME_ZONE, formatDateVN } from '@/lib/core/format';

const ROOTS = ['app', 'components', 'lib'];
const SKIP_DIRS = new Set(['node_modules', 'generated', '.next', '.expo']);
const SKIP_FILES = new Set(['lib/time-zone-pinned.test.ts']);

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
