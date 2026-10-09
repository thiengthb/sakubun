import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}\u{1F1E6}-\u{1F1FF}]/u;

const ROOTS = ['app', 'components', 'lib'];
const SKIP_DIRS = new Set(['node_modules', 'generated', '.next', '.expo']);
const SKIP_FILES = new Set(['lib/no-emoji.test.ts']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('no emoji anywhere in the codebase', () => {
  it('finds no emoji in app/, components/ or lib/', () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const rel = relative(process.cwd(), file).split(sep).join('/');
        if (SKIP_FILES.has(rel)) continue;
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (EMOJI.test(line)) offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 100)}`);
          });
      }
    }
    expect(
      offenders,
      `Emoji found (use a lucide icon, a markdown heading, or plain words):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
