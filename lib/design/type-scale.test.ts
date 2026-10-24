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
  'components/layout/app-logo.tsx', // 作文 badge glyph
  'components/layout/user-avatar.tsx', // avatar initials sizing
  'components/ui/', // shadcn primitive sizing tokens (button, calendar, …)
  'components/common/review-card.tsx', // quick-review card: the sentence and word on show
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

  it('reading content is 17px (text-body); controls keep their own 14px', () => {
    // thien's call (2026-10-24): content follows the thienui type scale (text-body = 17px on a 16px
    // root), buttons, tabs and labels stay text-sm. The baseline is set once, on the page shell and
    // its skeleton; cards and breadcrumbs (which stand in for page titles) must not shrink it back.
    const must: [string, RegExp][] = [
      ['components/layout/page-shell.tsx', /pt-6 pb-6 text-body'/],
      ['components/layout/page-skeleton.tsx', /pt-6 pb-6 text-body'/],
      ['components/layout/breadcrumbs.tsx', /<ol className="[^"]*\btext-body\b/],
      ['components/ui/card.tsx', /'group\/card [^']*\btext-body\b/],
    ];
    const missing = must
      .filter(([file, re]) => !re.test(readFileSync(file, 'utf8')))
      .map(([f]) => f);
    expect(missing, 'These set the 17px content baseline; keep text-body there:').toEqual([]);
  });

  it('containers that hold content do not shrink it back to 14px', () => {
    // Before this, TabsContent, Table and the Dialog/Sheet/Accordion bodies each set text-sm, so
    // everything inside a tab, a table row or a dialog read at 14px whatever the page said.
    const must: [string, RegExp][] = [
      ['components/ui/table.tsx', /'w-full caption-bottom text-body'/],
      ['components/ui/table.tsx', /'h-10 px-2 [^']*\btext-sm\b/], // header cells are labels
      ['components/ui/dialog.tsx', /bg-popover p-4 text-body /],
      ['components/ui/dialog.tsx', /'text-subhead text-muted-foreground/],
      ['components/ui/sheet.tsx', /bg-clip-padding text-body /],
      ['components/ui/sheet.tsx', /'text-subhead text-muted-foreground'/],
      ['components/ui/accordion.tsx', /overflow-hidden text-body /],
    ];
    const missing = must
      .filter(([file, re]) => !re.test(readFileSync(file, 'utf8')))
      .map(([f, re]) => `${f}  ${re}`);
    expect(missing, 'Content containers must keep the 17px body size:').toEqual([]);
    expect(
      readFileSync('components/ui/tabs.tsx', 'utf8'),
      'TabsContent inherits the page body size; a text-sm on it shrinks every tab',
    ).not.toMatch(/'flex-1 [^']*text-sm[^']*outline-none'/);
  });
});
