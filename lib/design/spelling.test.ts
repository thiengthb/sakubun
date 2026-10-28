import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// One spelling for one word on every screen (7.4j): "Xoá", as the docs write it, never the old spelling with the mark on o. The
// sample below is built from parts so this file does not read itself.
const OLD = new RegExp(['[Xx]', 'ó', 'a'].join(''), 'u');

const ROOTS = ['app', 'components', 'lib', 'e2e'];
const SKIP_DIRS = new Set(['node_modules', 'generated', '.next']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('one spelling for "Xoá"', () => {
  it('the check catches the old spelling', () => {
    expect(OLD.test(['Đã x', 'ó', 'a'].join(''))).toBe(true);
    expect(OLD.test('Đã xoá')).toBe(false);
  });

  it('finds the old spelling nowhere in app/, components/, lib/ or e2e/', () => {
    const offenders = ROOTS.flatMap((root) =>
      walk(root).flatMap((file) => {
        const rel = relative(process.cwd(), file).split(sep).join('/');
        return readFileSync(file, 'utf8')
          .split('\n')
          .flatMap((line, i) => (OLD.test(line) ? [`${rel}:${i + 1}  ${line.trim()}`] : []));
      }),
    );
    expect(offenders, `Write "Xoá", not the old spelling:\n${offenders.join('\n')}`).toEqual([]);
  });
});
