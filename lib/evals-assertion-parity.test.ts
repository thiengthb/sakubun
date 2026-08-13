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
 * The other half of #31 — telling invariant assertions apart from post-conditions — is already solved
 * upstream and arrives with the harness upgrade (PR #33). It is NOT the `requires-run` frontmatter flag
 * the issue proposed: it is a per-assertion `# requires-agent` comment line, which is strictly better
 * because a task can mix both kinds in one block, as `0003` does. Marking the task files is consumer-side
 * work and is done; the runner change is not ours to write.
 */

const TASKS_DIR = join(__dirname, '..', 'evals', 'tasks');
const RUNNER = join(__dirname, '..', 'evals', 'run.mjs');

/**
 * Which parser does THIS repo's runner have? The upgrade replaces `evals/run.mjs` (it is in
 * `MECHANISM_PATHS`), and the two versions disagree on the one thing this file mirrors:
 *
 *   - before: `split('\n')` — every line is executed as its own command
 *   - after:  `splitCommands()` — lines are joined into logical commands until quotes balance
 *
 * So "one line = one command" is a real constraint today and a false alarm tomorrow, and hardcoding
 * either answer makes this file wrong in one of the two worlds. Reading the runner keeps it a mirror
 * across the upgrade with no follow-up commit.
 *
 * It fails in the safe direction: if the joiner is ever renamed, we fall back to the stricter per-line
 * rule, which can only reject a form the runner would have accepted — never accept one it would break on.
 */
const PER_LINE = !/function splitCommands\b/.test(readFileSync(RUNNER, 'utf8'));

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

  const out: Assertion[] = [];
  let text = '';
  let line = 0;

  for (const [i, raw] of block[1].split('\n').entries()) {
    const trimmed = raw.trim();
    // A `#` line is a comment only OUTSIDE a command — same as both runners. `# requires-agent`
    // and `# full-arm-only:` are markers the runner reads here; to this checker they are comments.
    if (!text && (!trimmed || trimmed.startsWith('#'))) continue;
    if (!text) line = offset + i;
    text = text ? `${text}\n${trimmed}` : trimmed;
    // The unit the rules below judge is whatever the RUNNER would hand to the shell: one line under
    // the old parser, one balanced-quote command under the new one.
    if (PER_LINE || !unbalancedQuotes(text)) {
      out.push({ file, line, text });
      text = '';
    }
  }
  // Trailing fragment: the new runner flushes it too, so it reaches the shell broken. Report it.
  if (text) out.push({ file, line, text });

  return out;
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

/**
 * An unterminated quote means this text is a FRAGMENT, not a command. Used twice, for two jobs:
 * as the joining condition in `assertionsOf` (mirroring the new runner), and as the rule below.
 * Escaped quotes are removed first — `\"` closes nothing.
 */
function unbalancedQuotes(cmd: string): boolean {
  const bare = cmd.replace(/\\./g, '');
  return (bare.match(/"/g)?.length ?? 0) % 2 !== 0 || (bare.match(/'/g)?.length ?? 0) % 2 !== 0;
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
    //
    // Post-upgrade this fires far less, and that is correct rather than a weakening: `assertionsOf`
    // joins the fragments first, so what reaches here is a whole command, and an odd quote in a whole
    // command is an unterminated string under EITHER parser.
    label: PER_LINE
      ? 'dấu nháy lẻ — dòng này là MẢNH của một lệnh nhiều dòng, mà runner chạy từng dòng một'
      : 'dấu nháy lẻ — lệnh này có chuỗi chưa đóng, runner vẫn đẩy nguyên văn sang shell',
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
