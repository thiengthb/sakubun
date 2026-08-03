import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Enforces the MECHANICAL slice of the "text must truncate" rule (CLAUDE.md invariant #12 /
 * `docs/ui-patterns.json` `text-must-truncate`) as a GATE.
 *
 * The full rule is contextual (multi-line prose legitimately wraps), so it stays a `manual` lock in
 * the pattern registry. But its most common, silent failure mode IS mechanical and worth a gate: a
 * `truncate` / `line-clamp-1` class on a flex/grid child that has NO way to shrink — no `min-w-0`
 * ancestor and no own width cap — so `overflow: hidden` never engages and the text widens the row or
 * spills past it. That is exactly the bug that shipped in `bulk-group-button` / `item-groups` (a group
 * name in a `DropdownMenuItem`) and `item-detail-dialog` (a Japanese term beside an icon): the class
 * was there, doing nothing.
 *
 * The check, per file:
 *   - Find every class string that uses `truncate` or `line-clamp-1`.
 *   - An occurrence is SELF-ANCHORED if the SAME class string also carries `min-w-0` (it can shrink)
 *     or a width cap (`max-w-*` / `w-fit`) — then `truncate` works on its own.
 *   - Otherwise the occurrence needs a shrinkable ANCESTOR, which in this codebase always means a
 *     `min-w-0` somewhere in the same file. A file with an un-anchored occurrence and NO `min-w-0`
 *     anywhere is the omission this gate catches.
 *
 * A bare `<SpokenLine ... truncate>` (a JSX boolean prop, not a class string) is not matched — that
 * component applies its own `min-w-0 flex-1 truncate` internally (see components/shared/spoken-line.tsx).
 *
 * Same convention as `no-emoji` / `layout-standard` / `type-scale`: a legitimate exception goes in
 * ALLOW with a reason; never drop the `truncate` to dodge the gate, and never weaken the check.
 */

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

// Files where an un-anchored `truncate` is acceptable. Add here WITH a reason; do not weaken the check.
const ALLOW = new Map<string, string>([
  // (empty — the codebase is clean; entries land here only for a genuine, explained exception)
]);

// Extract the contents of every '...' / "..." / `...` string literal.
const STRING_LITERAL = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
// A class token, not a substring: `truncate` in the module path '@/components/ui/truncate' (preceded
// by '/') must NOT match — only a space/start-delimited Tailwind class does.
const TRUNCATE_TOKEN = /(?:^|\s)(?:truncate|line-clamp-1)(?:\s|$)/;
const SELF_ANCHOR = /\bmin-w-0\b|\bmax-w-|\bw-fit\b/;

describe('text-must-truncate — mechanical gate (CLAUDE.md #12)', () => {
  it('every class `truncate` can actually shrink (self-anchored, or a min-w-0 ancestor in the file)', () => {
    const offenders: string[] = [];
    for (const root of ['app', 'components']) {
      for (const file of walk(root)) {
        const path = rel(file);
        if (ALLOW.has(path)) continue;
        // Strip comments first: an apostrophe inside a `// don't …` comment would otherwise pair with
        // another quote and be scanned as a bogus "string" that happens to contain the word truncate.
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
        `Canonical: components/account/admin-view.tsx.\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
