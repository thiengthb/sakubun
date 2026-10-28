import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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

describe('UI layout standard (nuc-platform/12-ui-layout-standard.md)', () => {
  it('every page-level <TabsList> is passed via PageShell headerAside', () => {
    const ALLOW = new Set([
      'components/layout/page-shell.tsx', // documents the slot in a comment; renders no TabsList
      'components/features/resources/item-analytics.tsx', // detail page: Chỉ số / Thẻ are content sub-tabs UNDER the item header
      'components/common/tab-select.tsx',
      'components/common/page-tabs.tsx', // template pages: PageShell's own `tabs` row under the title
    ]);
    const offenders: string[] = [];
    for (const root of ['app', 'components']) {
      for (const file of walk(root)) {
        const path = rel(file);
        if (ALLOW.has(path) || path.endsWith('.test.tsx')) continue;
        const src = readFileSync(file, 'utf8');
        if (src.includes('<TabsList') && !src.includes('headerAside')) offenders.push(path);
      }
    }
    expect(
      offenders,
      'These render a <TabsList> as page content, so the tabs land BELOW the breadcrumb. Pass the ' +
        "TabsList to PageShell's `headerAside` so tabs sit BESIDE the breadcrumb (see " +
        `components/features/resources/resources-view.tsx):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('the mobile tab select opens below its trigger (position="popper")', () => {
    const src = readFileSync('components/common/active-tab-select.tsx', 'utf8');
    expect(
      /<SelectContent[^>]*position="popper"/.test(src),
      'ActiveTabSelect\'s <SelectContent> lost position="popper", so the option list is back to ' +
        'covering the tab pill it belongs to (SelectContent defaults to position="item-aligned").',
    ).toBe(true);
  });

  it('every app/**/page.tsx reaches a PageShell', () => {
    const EXEMPT = new Set([
      'app/login/page.tsx', // chromeless: brand and one card, no app menu before sign-in
      'app/consent/page.tsx', // chromeless like /login: the OAuth step between claude.ai and sakubun
      'app/privacy/page.tsx', // public text Google's consent screen links to, read before sign-in
      'app/terms/page.tsx', // public text Google's consent screen links to, read before sign-in
      'app/dev-skeleton/[route]/page.tsx',
    ]);
    const offenders: string[] = [];
    for (const file of walk('app')) {
      const path = rel(file);
      if (!path.endsWith('/page.tsx') || EXEMPT.has(path)) continue;
      const src = readFileSync(file, 'utf8');
      if (/\bredirect\(/.test(src)) continue;
      if (src.includes('PageShell')) continue;
      const views = [...src.matchAll(/from '@\/components\/([^']+)'/g)].map((m) => m[1]);
      const reachesShell = views.some((v) => {
        const vp = join('components', `${v}.tsx`);
        return existsSync(vp) && readFileSync(vp, 'utf8').includes('PageShell');
      });
      if (!reachesShell) offenders.push(path);
    }
    expect(
      offenders,
      'These pages render neither a PageShell nor a view that does. Every page uses PageShell ' +
        `(nuc-platform/12-ui-layout-standard.md):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('only RootDocument draws <html>, so every page gets the same fonts and theme', () => {
    // app/global-error.tsx replaces the root layout. It once drew its own <html>, lost next/font and
    // the theme, and fell back to Times while the rest of the app moved on.
    const offenders = ['app', 'components']
      .flatMap((root) => walk(root))
      .map(rel)
      .filter((path) => path !== 'components/layout/root-document.tsx' && !path.includes('.test.'))
      .filter((path) => /<html[\s>]/.test(readFileSync(path, 'utf8')));
    expect(
      offenders,
      `Render <RootDocument> (components/layout/root-document.tsx) instead of <html>:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
