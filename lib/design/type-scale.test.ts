import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

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

const DISPLAY_ALLOW = [
  'components/layout/auth-card.tsx', // auth hero — the shared /login + /register card title
  'components/layout/auth-nav.tsx', // wordmark on the auth pages
  'app/error.tsx', // error hero
  'app/global-error.tsx',
  'app/not-found.tsx',
  // Dashboard data display: stat-tile metrics and the 10px chart axis labels. Moved out of
  // app/page.tsx when the chart toolkit became a component — the exemption follows the code.
  'components/features/dashboard/dashboard-charts.tsx',
  'components/features/dashboard/streak-card.tsx', // streak count display
  'components/features/dashboard/streak-celebration.tsx',
  'components/features/dashboard/retention-gauge.tsx', // data-viz number/labels
  'components/features/resources/item-forgetting-curve.tsx',
  'components/features/resources/item-analytics.tsx', // per-item stat numbers
  'components/layout/page-chrome.ts', // template page title: 18px phone, 24px laptop (docs/ui-standard.md)
  'components/layout/app-logo.tsx', // 作文 badge glyph
  'components/layout/user-avatar.tsx', // avatar initials sizing
  'components/ui/', // shadcn primitive sizing tokens (button, calendar, …)
  'components/common/review-card.tsx', // quick-review card: the sentence and word on show
  'components/features/groups/group-cards.tsx', // flashcard face: the word alone, centred, as the hero
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

  it('content reads at one size, 14px, the same as the controls', () => {
    // thien's call (2026-10-24, reversing the 17px trial): content text is text-sm, like buttons,
    // tabs and labels, so a page reads at one size. The baseline is set once, on the page shell and
    // its skeleton, and the containers that hold content (card, table, dialog, sheet, accordion,
    // tab panel) carry the same size.
    const must: [string, RegExp][] = [
      ['components/layout/page-shell.tsx', /pt-6 pb-6 text-sm'/],
      ['components/layout/page-skeleton.tsx', /pt-6 pb-6 text-sm'/],
      ['components/layout/page-chrome.ts', /page: '[^']*\btext-sm\b/],
      ['components/layout/breadcrumbs.tsx', /<ol className="[^"]*\btext-sm\b/],
      ['components/ui/card.tsx', /'group\/card [^']*\btext-sm\b/],
      ['components/ui/table.tsx', /'w-full caption-bottom text-sm'/],
      ['components/ui/dialog.tsx', /bg-popover p-4 text-sm /],
      ['components/ui/sheet.tsx', /bg-clip-padding text-sm /],
      ['components/ui/accordion.tsx', /overflow-hidden text-sm /],
      ['components/ui/tabs.tsx', /'flex-1 text-sm outline-none'/],
    ];
    const missing = must
      .filter(([file, re]) => !re.test(readFileSync(file, 'utf8')))
      .map(([f, re]) => `${f}  ${re}`);
    expect(missing, 'These set the 14px content size; keep text-sm there:').toEqual([]);
  });

  it('no 17px or 15px text (text-body, text-subhead) in the app', () => {
    // The theme still defines these sizes; using them brings back two content sizes on one page.
    const offenders = scan(/\btext-(?:body|subhead)\b/);
    expect(
      offenders,
      `Content is text-sm, headings text-base, meta text-xs. Replace:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
