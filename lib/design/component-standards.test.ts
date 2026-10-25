import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// The component conventions, as tests rather than prose. Each one exists because the codebase had
// already drifted on it at least once — a rule nobody can break by accident is not worth a test.

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
const sources = (root: string) => walk(root).filter((f) => !/\.test\.tsx?$/.test(f));

describe('component standards', () => {
  it('square sizing uses size-N, not h-N w-N', () => {
    const offenders: string[] = [];
    for (const root of ['app', 'components']) {
      for (const file of sources(root)) {
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            for (const m of line.matchAll(/\bh-([0-9.]+) w-([0-9.]+)\b/g)) {
              if (m[1] === m[2]) offenders.push(`${rel(file)}:${i + 1}  ${m[0]} → size-${m[1]}`);
            }
          });
      }
    }
    expect(
      offenders,
      'Tailwind 4 has size-*, and mixing the two forms makes icon sizes hard to grep. Use size-N ' +
        `when height and width are equal:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('every reusable component takes a className', () => {
    // components/ui (primitives) and components/common (app-level shared) exist to be reused in
    // places their author did not foresee. A component that hardcodes its own spacing with no way
    // in forces the next caller to wrap it in a div — which is how layout drifts.
    const ALLOW = new Set([
      'components/common/use-server-action.ts', // hooks, not components
      'components/common/use-session-state.ts',
      'components/common/use-scroll-more.ts',
      'components/common/field-label-context.ts',
      'components/common/list-card.ts', // class constants a card list spreads, not a component
      'components/ui/use-fit-rows.ts',
      'components/layout/live-refresh.tsx', // render null — they are effects with a component shape
      'components/layout/scroll-restorer.tsx',
      'components/layout/scroll-to-top.tsx',
      'components/ui/sonner.tsx', // renders a third-party portal, styled through its own props
    ]);
    const offenders: string[] = [];
    for (const root of ['components/ui', 'components/common']) {
      for (const file of sources(root)) {
        const path = rel(file);
        if (ALLOW.has(path)) continue;
        if (!readFileSync(file, 'utf8').includes('className')) offenders.push(path);
      }
    }
    expect(
      offenders,
      'A shared component must accept className so a caller can place it. Add the prop and merge ' +
        `it with cn(), or add the file to ALLOW with a reason:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('class names are merged with cn(), never with raw template strings', () => {
    const offenders: string[] = [];
    for (const root of ['app', 'components']) {
      for (const file of sources(root)) {
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            // className={`… ${…}`} silently loses to Tailwind's later-wins rule; cn() resolves it.
            if (/className=\{`[^`]*\$\{/.test(line)) offenders.push(`${rel(file)}:${i + 1}`);
          });
      }
    }
    expect(
      offenders,
      'Interpolating a className string cannot resolve conflicts — "p-2" and a caller\'s "p-4" ' +
        `both end up in the attribute. Use cn() from @/lib/core/utils:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('presentational components live in components/, not inside a route file', () => {
    // app/ files are routes. A styled, reusable block defined inside one is invisible to every
    // other page — app/page.tsx carried its own SectionHeader for exactly this reason.
    const offenders: string[] = [];
    for (const file of sources('app')) {
      const path = rel(file);
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/^function ([A-Z]\w*)\(/gm)) {
        const body = src.slice(m.index);
        const end = body.indexOf('\n}\n');
        const decl = end === -1 ? body : body.slice(0, end);
        // Long class lists are the signal: a component carrying real styling is a design decision,
        // and design decisions belong where every page can find them.
        const classy = [...decl.matchAll(/className="([^"]{40,})"/g)];
        if (classy.length > 0) offenders.push(`${path}  ${m[1]}()`);
      }
    }
    expect(
      offenders,
      'Move these into components/ (common/ if more than one feature wants them, features/<x>/ ' +
        `otherwise) and import them back:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('features do not reach into each other', () => {
    // The whole point of the features/ split. A feature may use ui/, common/ and layout/; if two
    // features need the same thing, it is common/ by definition.
    //
    // The one exception is a COMPOSITION ROOT — the component a route renders to assemble a page
    // out of features. /resources is one page with three tabs and the third tab IS the groups
    // list, so that import is the page doing its job, not two features entangling.
    const ALLOW = new Set(['components/features/resources/resources-view.tsx']);
    const offenders: string[] = [];
    const root = 'components/features';
    for (const file of sources(root)) {
      const path = rel(file);
      if (ALLOW.has(path)) continue;
      const own = path.split('/')[2];
      for (const m of readFileSync(file, 'utf8').matchAll(
        /from '@\/components\/features\/([\w-]+)\//g,
      )) {
        if (m[1] !== own) offenders.push(`${path} imports from features/${m[1]}`);
      }
    }
    expect(
      offenders,
      'Cross-feature imports make features impossible to move or delete. Promote the shared part ' +
        `to components/common/:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('lib/core stays free of domain knowledge', () => {
    // core/ is imported by everything; if it may import back, every module is coupled to every
    // other one and the layering is decorative.
    const offenders: string[] = [];
    for (const file of sources('lib/core')) {
      for (const m of readFileSync(file, 'utf8').matchAll(/from '@\/lib\/([\w-]+)\//g)) {
        if (m[1] !== 'core' && m[1] !== 'generated') {
          offenders.push(`${rel(file)} imports @/lib/${m[1]}/`);
        }
      }
    }
    expect(
      offenders,
      'lib/core is the base layer: dates, text, class names, ActionResult. It must not depend on ' +
        `a domain:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('a paged list rests its footer at the window bottom', () => {
    // thien, Tài nguyên 2026-10-24: a list's pagination sits a page padding above the window's
    // bottom, the space a page cannot fill goes above it. Lịch sử round 3 shipped a card list whose
    // pages floated under the last row, because only DataTable did this. Whoever draws the pager
    // pins it.
    const unpinned = (src: string) =>
      /<DataPagination\b/.test(src) && !/usePinnedFooter\(/.test(src);
    expect(unpinned('<DataPagination page={1} />'), 'the check must catch a bare pager').toBe(true);
    expect(unpinned('usePinnedFooter({ footerRef });\n<DataPagination page={1} />')).toBe(false);

    const offenders: string[] = [];
    for (const root of ['app', 'components']) {
      for (const file of sources(root)) {
        if (rel(file) === 'components/ui/data-pagination.tsx') continue;
        if (unpinned(readFileSync(file, 'utf8'))) offenders.push(rel(file));
      }
    }
    expect(
      offenders,
      'These render <DataPagination> without usePinnedFooter (components/ui/use-fit-rows.ts). ' +
        'Wrap the pager in a footer box with a spacer and pin it, as DataTable and HistoryList do:\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });

  it('an add or edit form sends through SubmitButton, which stays off until it is ready', () => {
    // thien, 2026-10-25 (Thêm và Sửa tài nguyên round 1): an untouched form never answers a click
    // with "Cần nhập ..." errors; its send button is off until something new or changed is there.
    // SubmitButton (components/common/field.tsx) takes that state as a required `ready`, so a form
    // ending in FormActions with its own submit button skips the rule.
    const rawSubmit = (src: string) =>
      /<FormActions\b/.test(src) && (/type="submit"/.test(src) || !/<SubmitButton\b/.test(src));
    expect(rawSubmit('<FormActions><Button type="submit">Lưu</Button></FormActions>')).toBe(true);
    expect(rawSubmit('<FormActions><Button onClick={send}>Lưu</Button></FormActions>')).toBe(true);
    expect(
      rawSubmit('<FormActions><SubmitButton ready={ready}>Lưu</SubmitButton></FormActions>'),
    ).toBe(false);

    const offenders = sources('components')
      .filter((file) => rawSubmit(readFileSync(file, 'utf8')))
      .map(rel);
    expect(
      offenders,
      'These end in <FormActions> but send through their own button. Use <SubmitButton ready={...}>:\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });
});
