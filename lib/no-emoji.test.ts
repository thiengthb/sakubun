import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Project rule (2026-07-20, user-directed): NO emoji anywhere in this codebase — not in the UI, not in
 * user-facing copy, not in the Claude-facing MCP protocol, not in code comments.
 *
 * Why a test and not a line in CLAUDE.md: the rule had already been stated (the platform convention
 * says "lucide icons ONLY, no emoji as a UI icon-marker") and was broken again anyway, by me, in the
 * same session that wrote it down. A written rule is a reminder; a failing test is a gate. Same reason
 * `TutorialStep` makes its fields required rather than documenting that they are expected.
 *
 * The case against emoji, concretely:
 *  - They were decoration pretending to be structure. A markdown heading (`### Kết quả lượt này`) is a
 *    stronger anchor for "copy this block verbatim" than a pictograph, and costs fewer tokens on text
 *    that is re-sent every turn.
 *  - They leaked across layers: `lib/format.ts` baked emoji INTO `ratingLabel`, and the UI then had to
 *    call `stripEmoji()` to take them back out — a decoration added in one layer and undone in another.
 *
 * `stripEmoji` in `lib/text.ts` stays, and is NOT in conflict with this: it guards the WRITE boundary
 * against emoji arriving from Claude's generated content. This test guards what WE author.
 */

// Pictographs, dingbats, symbols, variation selector and keycap combiner. Deliberately excludes the
// arrow block (U+2190–21FF) so "A → B" in a comment survives, and of course all CJK/Vietnamese text.
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}\u{1F1E6}-\u{1F1FF}]/u;

const ROOTS = ['app', 'components', 'lib'];
const SKIP_DIRS = new Set(['node_modules', 'generated', '.next']);
// This file necessarily NAMES the ranges it bans; it contains escape sequences, not emoji, but keep it
// out of the walk so the rule can never fail on its own definition.
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
    // Reported as a list so a failure names every site at once instead of one per run.
    expect(
      offenders,
      `Emoji found (use a lucide icon, a markdown heading, or plain words):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
