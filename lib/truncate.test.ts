import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SKIP_DIRS = new Set(['node_modules', 'generated', '.next']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry) && !full.endsWith('.test.tsx')) out.push(full);
  }
  return out;
}

const rel = (file: string) => relative(process.cwd(), file).split(sep).join('/');

const ALLOW = new Map<string, string>([
]);

const STRING_LITERAL = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
const TRUNCATE_TOKEN = /(?:^|\s)(?:truncate|line-clamp-1)(?:\s|$)/;
const SELF_ANCHOR = /\bmin-w-0\b|\bmax-w-|\bw-fit\b/;

describe('text-must-truncate — mechanical gate (CLAUDE.md #12)', () => {
  it('every class `truncate` can actually shrink (self-anchored, or a min-w-0 ancestor in the file)', () => {
    const offenders: string[] = [];
    for (const root of ['app', 'components']) {
      for (const file of walk(root)) {
        const path = rel(file);
        if (ALLOW.has(path)) continue;
        const src = readFileSync(file, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, ' ')
          .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
        const fileHasShrink = /\bmin-w-0\b/.test(src);

        let unanchored = false;
        for (const m of src.matchAll(STRING_LITERAL)) {
          const cls = m[2];
          if (!TRUNCATE_TOKEN.test(cls)) continue;
          if (SELF_ANCHOR.test(cls)) continue; // shrinks or capped on its own element
          unanchored = true;
          break;
        }
        if (unanchored && !fileHasShrink) offenders.push(path);
      }
    }
    expect(
      offenders,
      'These files use a class `truncate`/`line-clamp-1` that cannot shrink — no `min-w-0` ancestor ' +
        'and no own `max-w-*`/`w-fit`, so the truncation silently does nothing and the text can widen ' +
        'or overflow its box. Add `min-w-0` to the flex/grid parent (or a width cap on the element). ' +
        `Canonical: components/settings/settings-account-tab.tsx.\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
