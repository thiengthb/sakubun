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
  'components/layout/page-state.tsx', // the title of a page that only reports a state (error, not found)
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
  'components/common/kanji-review-card.tsx', // quick-review kanji card: the glyph alone is the question
  'components/common/kanji-tile.tsx', // the kanji glyph on its tile is the content
  'components/common/kanji-detail.tsx', // the kanji glyph heading its dialog is the content
  'components/features/resources/radicals-view.tsx', // the radical glyph on its tile is the content
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

  it('content reads at 17px (text-body), controls and table cells at 14px', () => {
    // UI v2 D5 (thien, 2026-11-08, reversing the 2026-10-24 14px call): content takes the thienui
    // body size straight from the shared scale, so sakubun moves when thienui does. The baseline is
    // set once, on the page shell and its skeleton, and on the containers that hold content (card,
    // dialog, sheet, accordion, tab panel). Tables, breadcrumbs and controls stay at the ui role, 14px.
    const must: [string, RegExp][] = [
      ['components/layout/page-shell.tsx', /pt-6 pb-6 text-body'/],
      ['components/layout/page-skeleton.tsx', /pt-6 pb-6 text-body'/],
      ['components/layout/page-chrome.ts', /page: '[^']*\btext-body\b/],
      ['components/layout/page-chrome.ts', /title: 'text-title\b/],
      ['components/ui/card.tsx', /'group\/card [^']*\btext-body\b/],
      ['components/ui/dialog.tsx', /bg-popover p-4 text-body /],
      ['components/ui/sheet.tsx', /bg-clip-padding text-body /],
      ['components/ui/accordion.tsx', /overflow-hidden text-body /],
      ['components/ui/tabs.tsx', /'flex-1 text-body outline-none'/],
      ['components/layout/breadcrumbs.tsx', /<ol className="[^"]*\btext-sm\b/],
      ['components/ui/table.tsx', /'w-full caption-bottom text-sm'/],
    ];
    const missing = must
      .filter(([file, re]) => !re.test(readFileSync(file, 'utf8')))
      .map(([f, re]) => `${f}  ${re}`);
    expect(missing, 'These set the type roles (docs/ui-standard.md › Chữ); keep them:').toEqual([]);
  });

  it('no off-role sizes: 15px and 16px theme sizes (text-subhead, text-callout) are not roles', () => {
    // Roles: display, title, heading, body (text-body), ui (text-sm), caption (text-xs) and the three
    // jp-* roles (app/globals.css). 15 and 16px sit between body and ui and read as a mistake.
    const offenders = scan(/\btext-(?:subhead|callout)\b/);
    expect(
      offenders,
      `Use a type role (docs/ui-standard.md › Chữ) instead:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('every type role exists in app/globals.css', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    const roles = ['display', 'title', 'heading', 'jp-hero', 'jp-title', 'jp-body'];
    const missing = roles.filter((r) => !new RegExp(`@utility text-${r} \\{`).test(css));
    expect(missing).toEqual([]);
    expect(css, 'body role = the thienui 17px token').toMatch(/--text-body: 1\.0625rem;/);
    // A ratio line height (1.47 at 17px = 24.99px) leaves every block below it a fraction of a pixel
    // off: pinned footers and equal rows then miss by one. Roles set whole-pixel rem values.
    const roleBlocks = css.match(/@utility text-[a-z-]+ \{[\s\S]*?\n\}/g) ?? [];
    const ratio = roleBlocks.flatMap((b) =>
      [...b.matchAll(/line-height: ([^;]+);/g)].map((m) => m[1]).filter((v) => !/rem$/.test(v)),
    );
    expect(ratio, 'role line heights must be rem').toEqual([]);
    expect(css).toMatch(/--text-body--line-height: 1\.5625rem;/);
  });

  it('page titles leave room for stacked Vietnamese marks when they wrap', () => {
    // Ấ, Ổ, Ỷ put a second mark over a capital. Below 1.2x the font size the marks of line 2 touch line 1
    // (thien, U0 review 2026-11-09). Checks the phone and the desktop size of text-title.
    const css = readFileSync('app/globals.css', 'utf8');
    const rem = (name: string) => Number(css.match(new RegExp(`--${name}: ([0-9.]+)rem;`))![1]);
    const block = css.match(/@utility text-title \{[\s\S]*?\n\}/)![0];
    const sizes = [...block.matchAll(/font-size: var\(--([a-z0-9-]+)\);/g)].map((m) => rem(m[1]));
    const lines = [...block.matchAll(/line-height: ([0-9.]+)rem;/g)].map((m) => Number(m[1]));
    expect(sizes.length, 'phone and desktop sizes').toBe(2);
    expect(lines.length, 'phone and desktop line heights').toBe(2);
    const tight = sizes.flatMap((size, i) =>
      lines[i] < size * 1.2 ? [`${size * 16}px on a ${lines[i] * 16}px line`] : [],
    );
    expect(tight).toEqual([]);
  });
});
