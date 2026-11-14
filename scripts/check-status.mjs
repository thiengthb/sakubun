#!/usr/bin/env node
// Checks the size limits of docs/STATUS.md, so the file stays readable in two minutes.
// Copy to scripts/check-status.mjs in a project and run it in CI: node scripts/check-status.mjs
// Limits: whole file at most 40 lines, at most 3 items under "## Đang chờ thien".
// Also checks every docs/plans/*.md written from PLAN.template.md (has "## Checkpoint") has the sections
// the progress page reads (rules in profile/PLANNING.md of thienai-workflow).
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';

export const MAX_LINES = 40;
export const MAX_WAITING = 3;

/** Returns a list of problems in Vietnamese; empty when the file is within limits. */
export function checkStatus(text) {
  const problems = [];
  const lines = text.replace(/\n$/, '').split('\n');
  if (lines.length > MAX_LINES) {
    problems.push(`STATUS dài ${lines.length} dòng, tối đa ${MAX_LINES}. Rút gọn: lịch sử để trong git và PR.`);
  }
  const start = lines.findIndex((l) => /^##\s+Đang chờ thien\s*$/.test(l));
  if (start >= 0) {
    let waiting = 0;
    for (const l of lines.slice(start + 1)) {
      if (/^##\s/.test(l)) break;
      if (/^\s*(?:[-*]|\d+\.)\s+\S/.test(l) && !/^\s/.test(l)) waiting++;
    }
    if (waiting > MAX_WAITING) {
      problems.push(`Mục "Đang chờ thien" có ${waiting} việc, tối đa ${MAX_WAITING}. Hỏi thien bỏ hoặc dời việc nào.`);
    }
  }
  return problems;
}

export const PLAN_SECTIONS = ['Đang ở đâu', 'Mục tiêu', 'Không làm', 'Checkpoint', 'Đã đổi', 'Lỗi gặp'];

/** Returns problems for one plan file; plans written before the template (no "## Checkpoint") are skipped. */
export function checkPlan(text) {
  if (!/^## Checkpoint/m.test(text)) return [];
  const problems = [];
  if (!/^Trạng thái:\s*(đang chạy|tạm dừng|xong|bỏ)(?=[\s.,;·]|$)/m.test(text)) {
    problems.push('thiếu dòng "Trạng thái: đang chạy | tạm dừng | xong | bỏ" ở đầu file.');
  }
  for (const name of PLAN_SECTIONS) {
    if (!new RegExp(`^## ${name}`, 'm').test(text)) problems.push(`thiếu mục "## ${name}".`);
  }
  if (!/^### /m.test(text)) problems.push('mục Checkpoint chưa có checkpoint nào ("### 1. ...").');
  return problems;
}

// Compare real paths, not URL strings: on Windows, or with spaces or Vietnamese letters in the
// path, `file://${argv[1]}` never equals import.meta.url and the script silently did nothing.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const file = process.argv[2] ?? 'docs/STATUS.md';
  const problems = checkStatus(readFileSync(file, 'utf8')).map((p) => `${file}: ${p}`);
  const plansDir = join(dirname(file), 'plans');
  if (existsSync(plansDir)) {
    for (const f of readdirSync(plansDir).filter((n) => n.endsWith('.md'))) {
      for (const p of checkPlan(readFileSync(join(plansDir, f), 'utf8'))) problems.push(`${join(plansDir, f)}: ${p}`);
    }
  }
  for (const p of problems) console.error(p);
  if (problems.length) process.exit(1);
  console.log(`${file}: ổn`);
}
