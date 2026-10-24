import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

import { countViolations, overDebt, shrinkDebt, staleDebt, type Debt } from './thienui-debt';
import { elements, runUiRules, UI_RULES, type Source } from './ui-standard';

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
  it('the radius scale is 4px for controls and 8px for cards and dialogs', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    const radius = (name: string) => new RegExp(`--radius-${name}:\\s*([^;]+);`).exec(css)?.[1];
    expect(['sm', 'md', 'lg'].map(radius)).toEqual(['0.25rem', '0.25rem', '0.25rem']);
    expect(['xl', '2xl'].map(radius)).toEqual(['0.5rem', '0.5rem']);
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
