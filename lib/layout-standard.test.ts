import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Enforces the platform UI layout standard (`nuc-platform/12-ui-layout-standard.md`) as a GATE, not a
 * doc. Written because the same two regressions kept coming back after being written down: a tabbed page
 * rendering its `<TabsList>` as content (tabs land BELOW the breadcrumb instead of beside it), and a new
 * page skipping `PageShell` entirely. A failing test is the mechanism; CLAUDE.md is only the reminder
 * (same rationale as `no-emoji.test.ts`).
 *
 * If a check here legitimately should not apply to a file, add it to that check's allow-list WITH a
 * reason — don't weaken the check.
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

describe('UI layout standard (nuc-platform/12-ui-layout-standard.md)', () => {
  // Rule 4-ish: page-level tabs sit BESIDE the breadcrumb — a TabsList is passed to PageShell.headerAside,
  // never rendered as page content (which drops the tabs below the breadcrumb).
  it('every page-level <TabsList> is passed via PageShell headerAside', () => {
    const ALLOW = new Set([
      'components/shell/page-shell.tsx', // documents the slot in a comment; renders no TabsList
      'components/resources/item-analytics.tsx', // detail page: Chỉ số / Thẻ are content sub-tabs UNDER the item header
      'components/resources/resource-add-dialog.tsx', // tabs INSIDE a modal (Theo trường/Dán/Excel), not page-level tabs
      // The shared switcher itself (TabsList from md up, Select below). It is not a page — it is the
      // thing pages PASS to headerAside, so the rule applies to its callers, and they are still
      // checked: a page that rendered <TabSelect> as content instead would fail rule 4 elsewhere.
      'components/shared/tab-select.tsx',
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
        `components/resources/resources-view.tsx):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  // Rule 2: every route page renders inside a PageShell — either directly, or via a view component it
  // imports. Chromeless auth pages and the redirect stub are the only exemptions.
  it('every app/**/page.tsx reaches a PageShell', () => {
    const EXEMPT = new Set([
      'app/login/page.tsx', // chromeless (AuthNav, no breadcrumb)
      'app/register/page.tsx', // chromeless
    ]);
    const offenders: string[] = [];
    for (const file of walk('app')) {
      const path = rel(file);
      if (!path.endsWith('/page.tsx') || EXEMPT.has(path)) continue;
      const src = readFileSync(file, 'utf8');
      // Redirect stubs (e.g. /groups, /items, /vocab → /resources) render no UI.
      if (/\bredirect\(/.test(src)) continue;
      if (src.includes('PageShell')) continue;
      // Otherwise a view it imports from @/components must own the PageShell.
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
});
