import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Enforces the app TYPE SCALE (`nuc-platform/12-ui-layout-standard.md` §typography) as a GATE, not a
 * doc — the user called font size "the backbone of the whole app" after content kept rendering LARGER
 * than its title. The scale, top to bottom:
 *
 *   text-lg (18)  section/hero heading in chrome (sparingly)
 *   text-base (16) CardTitle / lead-emphasis
 *   text-sm (14)  BODY BASELINE — page content (set once on PageShell; inherited)
 *   text-xs (12)  meta / caption / timestamp / badge
 *
 * Two hard rules, both checked here:
 *  1. No DISPLAY size (text-xl and above) in app chrome — only hero/marketing/auth/error and
 *     data-display (big numbers, gauges, glyphs) may go bigger. This caps chrome text at text-lg, so a
 *     heading is always >= its content.
 *  2. No ARBITRARY font size (text-[13px], text-[0.8rem], …) — everything is on the scale. (60+ ad-hoc
 *     sizes had crept in.) Colour/var arbitraries like text-[#fff] / text-[var(--x)] are NOT sizes and
 *     are ignored.
 *
 * If a file legitimately needs a display / arbitrary size, add it to DISPLAY_ALLOW WITH a reason —
 * never weaken the regex. Same mechanism as no-emoji.test.ts / layout-standard.test.ts.
 */

const SKIP_DIRS = new Set(['node_modules', 'generated', '.next']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const rel = (file: string) => relative(process.cwd(), file).split(sep).join('/');

// Files/dirs exempt from the display-size ceiling: hero/marketing/auth/error pages and DATA-DISPLAY
// (large numbers, gauges, glyphs, primitive sizing) — none of these are body-vs-title text. Dir
// entries end with '/'; file entries are exact. Add here WITH a reason; do not weaken the check.
const DISPLAY_ALLOW = [
  // `components/landing/` sat here until 2026-08-06 — the directory no longer exists (the public
  // landing page went out with the multi-user surface). An allowlist entry for a deleted path is not
  // harmless: it is a standing permission nobody can audit, and it makes the list look longer than
  // the exemptions actually granted.
  'app/login/', // auth hero
  'app/register/',
  'components/shell/auth-nav.tsx', // wordmark on the auth pages
  'app/error.tsx', // error hero
  'app/global-error.tsx',
  'app/not-found.tsx',
  'app/page.tsx', // dashboard stat metrics (large numbers)
  'components/dashboard/streak-card.tsx', // streak count display
  'components/dashboard/streak-celebration.tsx',
  'components/dashboard/retention-gauge.tsx', // data-viz number/labels
  'components/resources/item-forgetting-curve.tsx',
  'components/resources/item-analytics.tsx', // per-item stat numbers
  'components/shell/app-logo.tsx', // 作文 badge glyph
  'components/shell/user-avatar.tsx', // avatar initials sizing
  'components/ui/', // shadcn primitive sizing tokens (button, calendar, …)
  // The flashcard FACE is data-display in the truest sense: the whole point of the card is one Japanese
  // word or pattern shown big enough to read, recall and self-test against — the same category as the
  // dashboard's metric numbers, not a heading competing with body text. Only the card face goes large;
  // its labels ("Nghĩa", "Ví dụ") are text-xs meta, and were fixed to the scale rather than exempted.
  'components/groups/group-flashcards.tsx',
  // Same argument, same card: /history's flashcard mode puts the đề on the face at reading size. Its
  // answer side is ordinary body text and stays on the scale.
  'components/history/history-flashcards.tsx',
  'components/guide/guide-steps.tsx', // scaled-down UI mockups in the /guide walkthrough (like the landing mocks)
  'components/guide/guide-primitives.tsx', // the mockup building blocks (Window/Chip/Field) those steps use
];

const allowed = (path: string) =>
  DISPLAY_ALLOW.some((a) => (a.endsWith('/') ? path.startsWith(a) : path === a));

const DISPLAY_RE = /\btext-(?:xl|[2-6]xl)\b/;
const ARBITRARY_SIZE_RE = /\btext-\[[0-9.]+(?:px|rem|em)\]/;

function scan(re: RegExp): string[] {
  const offenders: string[] = [];
  for (const root of ['app', 'components']) {
    for (const file of walk(root)) {
      const path = rel(file);
      if (path.endsWith('.test.tsx') || path.endsWith('.test.ts')) continue;
      const isAllow = allowed(path);
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (re.test(line) && !isAllow) offenders.push(`${path}:${i + 1}  ${line.trim()}`);
      });
    }
  }
  return offenders;
}

describe('Typography type scale (nuc-platform/12-ui-layout-standard.md §typography)', () => {
  it('no display size (text-xl+) outside hero/data-display files', () => {
    const offenders = scan(DISPLAY_RE);
    expect(
      offenders,
      'Display sizes (text-xl and above) belong to heroes and data numbers, not body/title text — ' +
        'they let content outgrow its heading. Use text-lg or smaller, or add the file to ' +
        `DISPLAY_ALLOW with a reason:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('no arbitrary font size (text-[Npx]/[Nrem]) — use the scale', () => {
    const offenders = scan(ARBITRARY_SIZE_RE);
    expect(
      offenders,
      'Arbitrary font sizes are off-scale. Map to text-xs/sm/base/lg (nuc-platform/12 §typography):\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });
});
