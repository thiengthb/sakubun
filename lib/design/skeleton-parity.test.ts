import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

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

function routeDirs(): { dir: string; page: string }[] {
  return walk('app')
    .filter((f) => rel(f).endsWith('/page.tsx'))
    .map((f) => ({ dir: rel(f).replace(/\/page\.tsx$/, ''), page: rel(f) }));
}

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

  // A template page and its skeleton take the tabs from one PageTabSet in page-heads.tsx, so the
  // loading screen writes the same tab names and underlines the one that will open.
  const TEMPLATE_TABBED: { name: string; source: string; loading: string }[] = [
    {
      name: 'dashboard',
      source: 'components/features/dashboard/analytics-tabs.tsx',
      loading: 'app/loading.tsx',
    },
    {
      name: 'resources',
      source: 'components/features/resources/resources-view.tsx',
      loading: 'app/resources/loading.tsx',
    },
    {
      name: 'settings',
      source: 'components/features/settings/settings-form.tsx',
      loading: 'app/settings/loading.tsx',
    },
    {
      name: 'resources/new',
      source: 'components/features/resources/resource-add-page.tsx',
      loading: 'app/resources/new/loading.tsx',
    },
    {
      name: 'item detail',
      source: 'components/features/resources/item-analytics.tsx',
      loading: 'app/resources/[id]/loading.tsx',
    },
  ];

  for (const t of TEMPLATE_TABBED) {
    it(`${t.name}: the skeleton draws the page's own tab set`, () => {
      const loading = readFileSync(t.loading, 'utf8');
      const name = /<PageTabsSkeleton set="(\w+)"/.exec(loading);
      expect(name, `${t.loading} renders no <PageTabsSkeleton set="…">`).not.toBeNull();
      const heads = readFileSync('components/layout/page-heads.tsx', 'utf8');
      const registry = /PAGE_TAB_SETS = \{([\s\S]*?)\}/.exec(heads)![1];
      const set = new RegExp(`\\b${name![1]}: (\\w+)`).exec(registry);
      expect(set, `PAGE_TAB_SETS has no "${name![1]}"`).not.toBeNull();
      expect(
        readFileSync(t.source, 'utf8'),
        `${t.source} does not draw its tabs from ${set![1]}`,
      ).toMatch(new RegExp(`\\b${set![1]}\\b`));
    });
  }

  // Untemplated pages keep the old tab rail until their step-6 PR.
  const TABBED: { name: string; source: string; loading: string; tabsVar: RegExp }[] = [
    {
      name: 'group detail',
      source: 'components/features/groups/group-detail-view.tsx',
      loading: 'app/groups/[id]/loading.tsx',
      tabsVar: /const GROUP_TABS = \[([\s\S]*?)\] as const/,
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
    const pairs: [string, string][] = [
      ['components/features/history/history-view.tsx', 'app/history/loading.tsx'],
      ['components/features/resources/item-analytics.tsx', 'app/resources/[id]/loading.tsx'],
    ];
    const offenders: string[] = [];
    for (const [source, loading] of pairs) {
      const hasHeaderTabs = /headerAside=\{[\s\S]{0,400}?TabSelect/.test(
        readFileSync(source, 'utf8'),
      );
      const skeletonHasRail = /<TabsAside/.test(readFileSync(loading, 'utf8'));
      if (!hasHeaderTabs && skeletonHasRail) offenders.push(`${loading} (page: ${source})`);
    }
    expect(
      offenders,
      `These skeletons draw a header tab rail for a page that has none:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
