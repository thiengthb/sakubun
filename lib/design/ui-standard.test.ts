import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

import { countViolations, overDebt, shrinkDebt, staleDebt, type Debt } from './thienui-debt';
import { elements, NOT_LIST_CARDS, runUiRules, UI_RULES, type Source } from './ui-standard';

// docs/ui-standard.md, as tests. Code written before the standard is recorded in
// ui-standard-debt.json; the record only shrinks (same ratchet as thienui-debt.json), and each
// step-6 page PR pays off its page.

const DEBT_FILE = 'lib/design/ui-standard-debt.json';
const LOWER = 'UPDATE_UI_STANDARD_DEBT=1 npx vitest run lib/design/ui-standard.test.ts';

/** Breaks that are right where they are. file -> rule id -> reason. */
const ALLOW: Record<string, Record<string, string>> = {
  'components/ui/tooltip.tsx': {
    'radius-class': 'the tooltip arrow is a 10px rotated square; 2px only softens its tip',
  },
};

const SKIP_DIRS = new Set(['node_modules', 'generated', '.next']);
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}
const rel = (file: string) => relative(process.cwd(), file).split(sep).join('/');

const files: Source[] = ['app', 'components'].flatMap((root) =>
  walk(root).map((f) => ({ path: rel(f), src: readFileSync(f, 'utf8') })),
);
const results = runUiRules(files).map((r) => ({
  ...r,
  violations: r.violations.filter((v) => !ALLOW[v.file]?.[r.id]),
}));
const found = countViolations(results);
const record = JSON.parse(readFileSync(DEBT_FILE, 'utf8')) as { $doc: string; debt: Debt };

if (process.env.UPDATE_UI_STANDARD_DEBT && existsSync(DEBT_FILE)) {
  record.debt = shrinkDebt(found, record.debt);
  writeFileSync(DEBT_FILE, JSON.stringify(record, null, 2) + '\n');
}

const check = (id: string, src: string, path = 'components/features/x/x.tsx') =>
  UI_RULES.find((r) => r.id === id)!.check({ path, src });

describe('ui standard: each check goes red on a bad sample', () => {
  it('radius-class', () => {
    expect(check('radius-class', '<div className="rounded-3xl" />')).toHaveLength(1);
    // Built from parts so the thienui no-arbitrary-scale-values guard does not read the sample.
    const bare = ['rounded-[', '12px]'].join('');
    expect(check('radius-class', '<span className="rounded-xs" />')).toEqual([]);
    expect(check('radius-class', `<div className="${bare}" />`)).toHaveLength(1);
    expect(
      check(
        'radius-class',
        '<div className="rounded rounded-t rounded-b-xl rounded-lg! rounded-[min(var(--radius-md),12px)]" />',
      ),
    ).toEqual([]);
  });

  it('no-round-controls', () => {
    expect(
      check('no-round-controls', '<Button\n  className={cn("size-9 rounded-full")}\n>x</Button>'),
    ).toHaveLength(1);
    expect(check('no-round-controls', '<span className="rounded-full" />')).toEqual([]);
  });

  it('control-weight', () => {
    expect(check('control-weight', '<Button className="font-bold">Lưu</Button>')).toHaveLength(1);
    expect(
      check('control-weight', '<Badge variant="outline" className="h-6 font-semibold">N2</Badge>'),
    ).toHaveLength(1);
    expect(check('control-weight', '<Button>Lưu</Button><span className="font-bold" />')).toEqual(
      [],
    );
  });

  it('control-language-in-components', () => {
    const src = '<button className="border-2 border-control-edge shadow-lift" />';
    expect(check('control-language-in-components', src)).toHaveLength(3);
    expect(check('control-language-in-components', src, 'components/ui/button.tsx')).toEqual([]);
  });

  it('create-label', () => {
    const imp = "import { Plus } from 'lucide-react';\n";
    expect(check('create-label', `${imp}<Button><Plus />Tạo nhóm</Button>`)).toHaveLength(1);
    expect(
      check('create-label', `${imp}<ExpandingIconButton icon={Plus} label="Thêm mục" />`),
    ).toHaveLength(1);
    expect(
      check('create-label', `${imp}<Button>{busy ? <Loader2 /> : <Plus />}\n  Thêm\n</Button>`),
    ).toEqual([]);
    expect(check('create-label', `${imp}<Button><Plus />{label}</Button>`)).toHaveLength(1);
    expect(check('create-label', `${imp}<Button><Plus aria-hidden />\n  Thêm\n</Button>`)).toEqual(
      [],
    );
    expect(
      check('create-label', `${imp}<Button size="icon" aria-label="Tăng"><Plus /></Button>`),
    ).toEqual([]);
  });

  it('icon-only-plain', () => {
    const imp = "import { Lightbulb, X } from 'lucide-react';\n";
    expect(
      check(
        'icon-only-plain',
        `${imp}<Button size="icon" aria-label="Gợi ý"><Lightbulb /></Button>`,
      ),
    ).toHaveLength(1);
    expect(check('icon-only-plain', `${imp}<Button size="icon-sm"><X /></Button>`)).toHaveLength(1);
    expect(
      check('icon-only-plain', `${imp}<Button size="icon" aria-label="Đóng"><X /></Button>`),
    ).toEqual([]);
    expect(check('icon-only-plain', `${imp}<Button><Lightbulb />Gợi ý</Button>`)).toEqual([]);
    // ExpandingIconButton shows the word itself: on hover on a laptop, always on a phone for this icon.
    expect(
      check('icon-only-plain', `${imp}<ExpandingIconButton icon={Lightbulb} label="Gợi ý" />`),
    ).toEqual([]);
  });

  it('card-actions-icon-only', () => {
    const card = 'components/features/library/library-entry-card.tsx';
    expect(check('card-actions-icon-only', '<Button size="sm">Lấy</Button>', card)).toHaveLength(1);
    expect(
      check('card-actions-icon-only', '<Button>{busy ? <Spinner /> : null}Đã có</Button>', card),
    ).toHaveLength(1);
    expect(
      check(
        'card-actions-icon-only',
        '<Button aria-label="Lấy">{busy ? <Spinner /> : <Plus />}</Button>',
        card,
      ),
    ).toEqual([]);
    expect(check('card-actions-icon-only', '<CardAction icon={Plus} label="Lấy" />', card)).toEqual(
      [],
    );
    // Only cards in a list: a page or the study card keeps its worded buttons.
    expect(check('card-actions-icon-only', '<Button>Lấy</Button>')).toEqual([]);
    expect(
      check(
        'card-actions-icon-only',
        '<Button>Lật thẻ</Button>',
        'components/common/review-card.tsx',
      ),
    ).toEqual([]);
  });

  it('every card kept out of the list-card rules still exists', () => {
    expect(Object.keys(NOT_LIST_CARDS).filter((f) => !existsSync(f))).toEqual([]);
  });

  it('card-text-one-line', () => {
    const card = 'components/common/resource-card.tsx';
    expect(check('card-text-one-line', '<p className="line-clamp-2">x</p>', card)).toHaveLength(1);
    expect(check('card-text-one-line', '<Truncate>{meaningVi}</Truncate>', card)).toEqual([]);
    expect(check('card-text-one-line', '<p className="line-clamp-3">x</p>')).toEqual([]);
  });

  it('header-actions-icon', () => {
    expect(
      check('header-actions-icon', 'actions={<Button variant="outline"><Pencil />Sửa</Button>}'),
    ).toHaveLength(1);
    expect(
      check(
        'header-actions-icon',
        'actions={<><CopyCommandButton command={c} label="Luyện nhóm" size="default" /></>}',
      ),
    ).toHaveLength(1);
    expect(
      check(
        'header-actions-icon',
        'actions={<><CopyCommandButton command={c} label="Luyện" expandOnHover /><ExpandingIconButton icon={Pencil} label="Sửa" /></>}',
      ),
    ).toEqual([]);
    // The primary action keeps its word; a button elsewhere on the page is not a header action.
    expect(
      check(
        'header-actions-icon',
        'actions={<Button onClick={take}><Download />Lấy cả nhóm</Button>}',
      ),
    ).toEqual([]);
    expect(check('header-actions-icon', '<Button variant="outline">Sửa</Button>')).toEqual([]);
  });

  it('no-form-dialog', () => {
    expect(
      check('no-form-dialog', '<DialogContent><GroupForm onDone={done} /></DialogContent>'),
    ).toHaveLength(1);
    expect(
      check('no-form-dialog', '<DialogContent><Input /><Textarea /></DialogContent>'),
    ).toHaveLength(1);
    expect(check('no-form-dialog', '<DialogContent><Input /></DialogContent>')).toEqual([]);
  });

  it('page-template', () => {
    expect(check('page-template', '<PageShell section="settings">x</PageShell>')).toHaveLength(1);
    expect(check('page-template', '<PageShell template="form">x</PageShell>')).toHaveLength(1);
    expect(check('page-template', '<PageSkeleton template="form" title="Cài đặt" />')).toEqual([]);
    expect(check('page-template', '<PageSkeleton title="Cài đặt" />')).toHaveLength(1);
    // A loading screen writes the words the page will show: no bare title or trail bars.
    expect(check('page-template', '<PageSkeleton template="form" />')).toHaveLength(1);
    expect(
      check('page-template', '<PageSkeleton template="form" title="Sửa nhóm" trail />'),
    ).toHaveLength(1);
    expect(
      check(
        'page-template',
        '<PageSkeleton template="form" title="Sửa nhóm" trail={<ParentCrumbs section="groups" self />} />',
      ),
    ).toEqual([]);
  });

  it('elements() finds the body across nesting and arrow functions in props', () => {
    const [el] = elements('<Button onClick={() => go(1)}><Button>in</Button><X /></Button>', [
      'Button',
    ]);
    expect(el.open).toBe('<Button onClick={() => go(1)}>');
    expect(el.body).toBe('<Button>in</Button><X />');
  });
});

describe('ui standard: the codebase', () => {
  it('the radius scale is 8px for controls, cards and dialogs', () => {
    // thien, 2026-10-25: 7px for controls (chosen from 4 to 10px side by side), then 8px after
    // seeing 7px on the real pages.
    const css = readFileSync('app/globals.css', 'utf8');
    const radius = (name: string) => new RegExp(`--radius-${name}:\\s*([^;]+);`).exec(css)?.[1];
    expect(['sm', 'md', 'lg'].map(radius)).toEqual(['0.5rem', '0.5rem', '0.5rem']);
    expect(['xl', '2xl'].map(radius)).toEqual(['0.5rem', '0.5rem']);
  });

  it('bold is 600 and extra bold 700', () => {
    // thien, item detail round 2 (2026-10-25): 700 and 800 read heavy beside body text.
    const css = readFileSync('app/globals.css', 'utf8');
    const weight = (name: string) =>
      new RegExp(`--font-weight-${name}:\\s*([^;]+);`).exec(css)?.[1];
    expect(['bold', 'extrabold'].map(weight)).toEqual(['600', '700']);
  });

  it('no break beyond the recorded debt', () => {
    const lines = overDebt(found, record.debt).flatMap((d) => {
      const rule = results.find((r) => r.id === d.rule)!;
      return [
        `[${d.rule}] ${d.file}: ${d.found} found, ${d.allowed} allowed. ${rule.rule}`,
        ...rule.violations
          .filter((v) => v.file === d.file)
          .map((v) => `    ${v.file}:${v.line}  ${v.excerpt}`),
      ];
    });
    expect(
      lines,
      'Follow docs/ui-standard.md (the shared component usually does it for you). Never add to ' +
        `ui-standard-debt.json.\n${lines.join('\n')}`,
    ).toEqual([]);
  });

  it('paid-off debt is removed from the record', () => {
    const lines = staleDebt(found, record.debt).map(
      (d) => `[${d.rule}] ${d.file}: ${d.allowed} allowed, ${d.found} left`,
    );
    expect(
      lines,
      `Good, these were fixed. Lower the record with:\n  ${LOWER}\n${lines.join('\n')}`,
    ).toEqual([]);
  });
});
