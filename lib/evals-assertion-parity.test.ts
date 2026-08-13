import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Parity Contract for eval assertions (issue #31).
 *
 * `evals/run.mjs → runAssertions` executes every line of the `## Chấm lớp 1` bash block with
 * `spawnSync(c, { shell: true })`. On Windows that shell is cmd.exe, where three things people
 * reflexively write in bash do not exist:
 *
 *   - `> /dev/null`  — there is no such path, so the line fails on EVERY run
 *   - leading `!`    — not a negation operator, cmd.exe reads it as part of the command name
 *   - `|`            — a pipe exists but exit-status semantics differ, and it is never needed here
 *
 * A line carrying any of those is not "a failing assertion", it is an assertion that can never pass
 * on one of the three supported platforms. That is exactly the failure mode
 * `knowledge/lessons/0002-guard-ban-nham.md` warns about: a gate that is permanently red for a reason
 * unrelated to what it measures teaches everyone to stop reading the number. It was measured on
 * 2026-08-12 (Windows 11, clean repo): `node evals/run.mjs` reported REGRESSION 40%, and not one of
 * the red assertions was a real regression.
 *
 * Why a test rather than a comment: the constraint was already written down, twice, as prose in
 * `0002` and `0005` — and `evals/tasks/_TEMPLATE.md` still teaches the opposite in its example block
 * (`! git status --porcelain | grep -q .`), which is where the habit comes from. Prose that competes
 * with a template loses. This is the cheap deterministic check issue #31 asks for, and AGENTS.md
 * ranks computational control above the inferential kind.
 *
 * This deliberately does NOT solve the other half of #31 (telling invariant assertions apart from
 * post-conditions via a `requires-run` flag) — that one lives in `evals/run.mjs`, a seed file the
 * harness upgrade overwrites, so it belongs upstream.
 */

const TASKS_DIR = join(__dirname, '..', 'evals', 'tasks');

/**
 * Mirror of `runAssertions` in `evals/run.mjs`. It MUST stay a mirror: a checker that parses the
 * block differently from the runner guards lines the runner never executes, and misses the ones it
 * does. Kept as one regex + one filter, copied shape-for-shape, so the drift is easy to spot.
 */
const BLOCK = /## Chấm lớp 1[\s\S]*?```bash\n([\s\S]*?)```/;

interface Assertion {
  file: string;
  line: number;
  text: string;
}

function assertionsOf(file: string, source: string): Assertion[] {
  const block = source.match(BLOCK);
  if (!block) return [];

  // Line number of the first line INSIDE the fence, so a failure message points at the real line.
  const firstLine = source.slice(0, block.index! + block[0].indexOf('```bash\n') + '```bash\n'.length);
  const offset = firstLine.split('\n').length;

  return block[1]
    .split('\n')
    .map((text, i) => ({ file, line: offset + i, text: text.trim() }))
    .filter((a) => a.text && !a.text.startsWith('#'));
}

/**
 * Blank out everything inside quotes, so the rules below see only what the SHELL interprets.
 *
 * Without this the checker fires on `Object.entries(f.platforms||{})` — a JavaScript logical-or
 * inside a `node -e "..."` payload, which no shell ever reads as a pipe. A checker that cannot tell
 * those apart is the same "confidently wrong diagnostic" this repo has now filed four issues about
 * (#4, #8, #13, and the runner in #31), so it is worth the twenty lines.
 */
function shellVisible(cmd: string): string {
  let out = '';
  let quote: "'" | '"' | null = null;
  for (const ch of cmd) {
    if (quote) {
      out += ch === quote ? ch : ' ';
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Every line must be a COMPLETE command: the runner executes lines one at a time, never as a script. */
function unbalancedQuotes(cmd: string): boolean {
  return (cmd.match(/"/g)?.length ?? 0) % 2 !== 0 || (cmd.match(/'/g)?.length ?? 0) % 2 !== 0;
}

/** One rule per construct, each naming what it breaks and where. */
const FORBIDDEN: readonly { label: string; hit: (cmd: string) => boolean }[] = [
  {
    label: '`/dev/null` — không tồn tại trên cmd.exe, dòng này đỏ ở MỌI lần chạy trên Windows',
    hit: (c) => shellVisible(c).includes('/dev/null'),
  },
  {
    label: '`!` phủ định — cmd.exe không có toán tử này, nó đọc `!` như một phần của tên lệnh',
    hit: (c) => /^!\s/.test(c),
  },
  {
    label: '`|` — mã thoát của pipe khác nhau giữa các shell; assertion chỉ nên dựa vào mã thoát của MỘT lệnh',
    hit: (c) => shellVisible(c).includes('|'),
  },
  {
    // Found 2026-08-13 in `0003-khong-tu-khen.md`: a `node -e "` payload spread over five lines. The
    // runner split it into five separate commands, every one of them a syntax error, on every OS —
    // a defect strictly worse than the Windows-only ones above, and invisible until you simulate the
    // parse. Balanced quotes is the cheapest signal that a line stands on its own.
    label: 'dấu nháy lẻ — dòng này là MẢNH của một lệnh nhiều dòng, mà runner chạy từng dòng một',
    hit: unbalancedQuotes,
  },
];

describe('assertion trong evals/tasks chạy được trên cả ba OS', () => {
  const files = readdirSync(TASKS_DIR).filter((f) => f.endsWith('.md'));

  it('có task để kiểm', () => {
    // Guard against the whole suite silently passing because the directory moved or the heading in
    // `runAssertions` was renamed — a green check over zero assertions is the failure this test exists
    // to prevent, one level up.
    expect(files.length).toBeGreaterThan(0);
  });

  it('không dùng /dev/null, `!` phủ định, hay `|`', () => {
    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(join(TASKS_DIR, file), 'utf8');
      for (const a of assertionsOf(file, source)) {
        for (const rule of FORBIDDEN) {
          if (rule.hit(a.text)) violations.push(`evals/tasks/${a.file}:${a.line}  ${a.text}\n    → ${rule.label}`);
        }
      }
    }

    expect(violations, `\n${violations.join('\n')}\n`).toEqual([]);
  });
});
