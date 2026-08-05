import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Keeps every route's `loading.tsx` in step with the page it stands in for — the STRUCTURAL half of the
 * skeleton contract. The geometric half is `e2e/skeleton.spec.ts` (it measures both in a browser at 1440
 * and 390); this file catches the two drifts that need no browser and no data:
 *
 *   1. A route with a PageShell but NO loading.tsx. Next silently falls back to the nearest ancestor's,
 *      which is the ROOT one — so six routes (guide, both forms, three group routes) spent weeks flashing
 *      a DASHBOARD skeleton, full-bleed, before rendering a narrow form. Nothing failed; the fallback is
 *      a feature.
 *   2. A stale TAB COUNT. /settings gained its fifth tab on 2026-08-04 and its skeleton still drew four;
 *      /history lost both of its tabs and its skeleton still drew two. The count is what sets the rail's
 *      width, so it is also the number that overflowed a phone by 134px.
 *
 * Both are read from the SOURCE of each page, so they cannot go stale on their own: the day a page's tab
 * list changes, this test names the loading file that has to change with it.
 */

const SKIP_DIRS = new Set(['node_modules', 'generated', '.next']);

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const rel = (file: string) => relative(process.cwd(), file).split(sep).join('/');

/** Every route directory under app/ that renders a page. */
function routeDirs(): { dir: string; page: string }[] {
  return walk('app')
    .filter((f) => rel(f).endsWith('/page.tsx'))
    .map((f) => ({ dir: rel(f).replace(/\/page\.tsx$/, ''), page: rel(f) }));
}

/** Follow a page's own source plus the components it imports from @/components, one level deep. */
function pageWithViews(pagePath: string): string {
  const src = readFileSync(pagePath, 'utf8');
  const views = [...src.matchAll(/from '@\/components\/([^']+)'/g)]
    .map((m) => join('components', `${m[1]}.tsx`))
    .filter((p) => existsSync(p))
    .map((p) => readFileSync(p, 'utf8'));
  return [src, ...views].join('\n');
}

describe('loading skeletons match their routes', () => {
  it('every route that renders a PageShell has its own loading.tsx', () => {
    // Routes whose fallback is deliberately inherited, with the reason.
    const EXEMPT: Record<string, string> = {
      app: 'the root loading.tsx IS this route’s (the dashboard) and the fallback for the rest',
      'app/login': 'chromeless auth page — no PageShell, no chrome to placeholder',
      'app/register': 'chromeless auth page',
      'app/groups': 'redirect stub to /resources?tab=groups — renders no UI',
      'app/items': 'redirect stub to /resources?tab=grammar',
      'app/vocab': 'redirect stub to /resources?tab=vocab',
      'app/dev-skeleton/[route]': 'dev-only harness that RENDERS the skeletons; 404 in production',
    };
    const missing: string[] = [];
    for (const { dir, page } of routeDirs()) {
      if (EXEMPT[dir]) continue;
      const src = pageWithViews(page);
      if (!src.includes('PageShell')) continue;
      if (!existsSync(join(dir, 'loading.tsx'))) missing.push(dir);
    }
    expect(
      missing,
      'These routes render a PageShell but have no loading.tsx, so Next falls back to the ROOT one — ' +
        'which is the DASHBOARD skeleton, at full page width:\n' +
        missing.map((d) => `${d}/loading.tsx`).join('\n'),
    ).toEqual([]);
  });

  // Each entry: the page source that owns the tab list, and its loading file. The count in the loading
  // file's `<TabsAside count={N}>` must equal the number of tabs the page actually renders.
  const TABBED: { name: string; source: string; loading: string; tabsVar: RegExp }[] = [
    {
      name: 'dashboard',
      source: 'components/dashboard/analytics-tabs.tsx',
      loading: 'app/loading.tsx',
      tabsVar: /items=\{\[([\s\S]*?)\]\}/,
    },
    {
      name: 'resources',
      source: 'components/resources/resources-view.tsx',
      loading: 'app/resources/loading.tsx',
      tabsVar: /const RESOURCE_TABS = \[([\s\S]*?)\] as const/,
    },
    {
      name: 'settings',
      source: 'components/settings/settings-form.tsx',
      loading: 'app/settings/loading.tsx',
      tabsVar: /const SETTINGS_TABS = \[([\s\S]*?)\] as const/,
    },
    {
      name: 'guide',
      source: 'components/guide/guide-tabs.tsx',
      loading: 'app/guide/loading.tsx',
      tabsVar: /const GUIDE_TAB_ITEMS = \[([\s\S]*?)\] as const/,
    },
    {
      name: 'group detail',
      source: 'components/groups/group-detail-view.tsx',
      loading: 'app/groups/[id]/loading.tsx',
      tabsVar: /const GROUP_TABS = \[([\s\S]*?)\] as const/,
    },
    {
      name: 'resources/new',
      source: 'components/resources/resource-add-form.tsx',
      loading: 'app/resources/new/loading.tsx',
      tabsVar: /export const INPUT_TABS = \[([\s\S]*?)\] as const/,
    },
  ];

  for (const t of TABBED) {
    it(`${t.name}: the skeleton draws as many tabs as the page`, () => {
      const block = t.tabsVar.exec(readFileSync(t.source, 'utf8'));
      expect(block, `could not find the tab list in ${t.source}`).not.toBeNull();
      const tabs = [...block![1].matchAll(/value:/g)].length;
      const loading = readFileSync(t.loading, 'utf8');
      const count = /<TabsAside[^>]*count=\{(\d+)\}/.exec(loading);
      expect(count, `${t.loading} renders no <TabsAside count={…}>`).not.toBeNull();
      expect(
        Number(count![1]),
        `${t.loading} draws ${count![1]} tab placeholders but ${t.source} renders ${tabs} tabs — ` +
          'the rail width is derived from this count, so a stale one is also a mobile overflow.',
      ).toBe(tabs);
    });
  }

  it('a page with no tabs has no tab rail in its skeleton', () => {
    // /history lost its tabs with the community feed; its skeleton kept drawing them for two days.
    const pairs: [string, string][] = [
      ['components/history/history-view.tsx', 'app/history/loading.tsx'],
      ['components/resources/item-analytics.tsx', 'app/resources/[id]/loading.tsx'],
    ];
    const offenders: string[] = [];
    for (const [source, loading] of pairs) {
      const hasHeaderTabs = /headerAside=\{[\s\S]{0,400}?TabSelect/.test(readFileSync(source, 'utf8'));
      const skeletonHasRail = /<TabsAside/.test(readFileSync(loading, 'utf8'));
      if (!hasHeaderTabs && skeletonHasRail) offenders.push(`${loading} (page: ${source})`);
    }
    expect(
      offenders,
      `These skeletons draw a header tab rail for a page that has none:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
