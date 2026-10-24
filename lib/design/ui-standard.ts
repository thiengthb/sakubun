import type { PatternResult, Violation } from '@/tooling/thienui-guards/src/pattern-lock.mjs';

// The machine-checkable rules of docs/ui-standard.md. Pure: each check takes a file's path and
// source and returns what breaks the rule, so ui-standard.test.ts can prove every check goes red on
// a bad sample before trusting it on the codebase.

export interface Source {
  path: string;
  src: string;
}

export interface UiRule {
  id: string;
  rule: string;
  check: (file: Source) => Omit<Violation, 'file'>[];
}

interface Element {
  name: string;
  /** The opening tag, `<Name ... >`. */
  open: string;
  /** What sits between the opening and closing tag; empty for a self-closing tag. */
  body: string;
  index: number;
}

const lineAt = (src: string, index: number) => src.slice(0, index).split('\n').length;
const excerpt = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 100);

/** Where the opening tag that starts at `start` ends: the `>` outside every `{}` and string. */
function openTagEnd(src: string, start: number): number {
  let depth = 0;
  let quote = '';
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote && src[i - 1] !== '\\') quote = '';
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i;
  }
  return -1;
}

/** Every JSX element with one of these names, with its body. Same-name nesting is counted. */
export function elements(src: string, names: string[]): Element[] {
  const out: Element[] = [];
  const rx = new RegExp(`<(${names.join('|')})(?=[\\s/>])`, 'g');
  for (const m of src.matchAll(rx)) {
    const end = openTagEnd(src, m.index);
    if (end === -1) continue;
    const open = src.slice(m.index, end + 1);
    let body = '';
    if (!open.endsWith('/>')) {
      const tag = new RegExp(`<(/?)${m[1]}(?=[\\s/>])`, 'g');
      tag.lastIndex = end + 1;
      let depth = 1;
      for (let t = tag.exec(src); t; t = tag.exec(src)) {
        const close = openTagEnd(src, t.index);
        if (t[1]) depth--;
        else if (!src.slice(t.index, close + 1).endsWith('/>')) depth++;
        if (depth === 0) {
          body = src.slice(end + 1, t.index);
          break;
        }
      }
    }
    out.push({ name: m[1], open, body, index: m.index });
  }
  return out;
}

/** Names this file imports from lucide-react. */
function lucideNames(src: string): Set<string> {
  const out = new Set<string>();
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/g)) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop();
      if (name && /^[A-Z]/.test(name)) out.add(name);
    }
  }
  return out;
}

/** Lucide icons a control shows: in its body, or passed as `icon={X}`. */
function iconsOf(el: Element, lucide: Set<string>): string[] {
  const used = [...el.body.matchAll(/<([A-Z]\w*)/g), ...el.open.matchAll(/\bicon=\{([A-Z]\w*)\}/g)];
  return [...new Set(used.map((m) => m[1]).filter((n) => lucide.has(n)))];
}

const CONTROLS = [
  'Button',
  'button',
  'Link',
  'a',
  'Toggle',
  'ToggleGroupItem',
  'SelectTrigger',
  'Input',
];
const ICON_SIZE = /\bsize=(?:"icon[\w-]*"|\{'icon[\w-]*'\})/;

/** Icons whose meaning nobody has to guess. Anything else needs a word next to it. */
export const PLAIN_ICONS = new Set([
  'ArrowLeft',
  'ArrowUp',
  'Check',
  'ChevronDown',
  'ChevronLeft',
  'ChevronRight',
  'ChevronUp',
  'Copy',
  'Eye',
  'EyeOff',
  'Info',
  'Loader2',
  'Minus',
  'Moon',
  'MoreHorizontal',
  'MoreVertical',
  'PanelLeftIcon',
  'Pause',
  'Pencil',
  'Play',
  'Plus',
  'Search',
  'Star',
  'Sun',
  'Trash2',
  'Volume2',
  'X',
  'XIcon',
]);

/** What may follow `rounded`: an optional side (t, b, l, r, s, e, tl, ...), a step, an optional `!`. */
const RADIUS_SUFFIX =
  /^(?:-[tblrse]{1,2})?(?:-(?:none|sm|md|lg|xl|2xl|full|\[[^\]]*var\(--radius[^\]]*\]))?!?$/;

export const UI_RULES: UiRule[] = [
  {
    id: 'radius-class',
    rule:
      'Rounding comes from the radius scale (none, sm to 2xl, full) or an arbitrary value that ' +
      'reads a --radius token. Controls are 4px, cards and dialogs 8px.',
    check: ({ src }) =>
      [...src.matchAll(/(?<![\w-])rounded((?:-[^\s"'`]*)?)/g)]
        .filter((m) => !RADIUS_SUFFIX.test(m[1]))
        .map((m) => ({ line: lineAt(src, m.index), excerpt: m[0] })),
  },
  {
    id: 'no-round-controls',
    rule: 'No button, link, toggle or field is fully round: controls use the 4px radius.',
    check: ({ src }) =>
      elements(src, CONTROLS)
        .filter((el) => /(?<![\w-])rounded-full\b/.test(el.open))
        .map((el) => ({ line: lineAt(src, el.index), excerpt: `<${el.name}> rounded-full` })),
  },
  {
    id: 'control-language-in-components',
    rule:
      'The raised lift, the 2px control edge, the field fill and the chosen wash live in ' +
      'components/ui, common and layout. A page or feature uses the component, never the classes.',
    check: ({ path, src }) => {
      if (!/^(?:app|components\/features)\//.test(path)) return [];
      const rx =
        /(?<![\w-])(?:shadow-lift[\w-]*|border-control-edge|bg-field|bg-brand-wash|border-brand-wash|border-2|shadow-\[[^\]]*\]|active:translate-y-[\w.]+)/g;
      return [...src.matchAll(rx)].map((m) => ({ line: lineAt(src, m.index), excerpt: m[0] }));
    },
  },
  {
    id: 'create-label',
    rule: 'A button that creates something (a Plus icon with a word) says exactly "Thêm".',
    check: ({ src }) => {
      const lucide = lucideNames(src);
      if (!lucide.has('Plus')) return [];
      return elements(src, ['Button', 'ExpandingIconButton'])
        .filter((el) => iconsOf(el, lucide).includes('Plus'))
        .flatMap((el) => {
          const prop = /(?<![\w-])label=(?:"([^"]*)"|\{([^}]*)\})/.exec(el.open);
          const text = el.body
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          const label = prop ? (prop[1] ?? `{${prop[2]}}`) : text;
          if (label === '' || label === 'Thêm') return [];
          return [{ line: lineAt(src, el.index), excerpt: `label "${excerpt(label)}"` }];
        });
    },
  },
  {
    id: 'icon-only-plain',
    rule:
      'A button with only an icon uses an icon from PLAIN_ICONS and has an aria-label. Any other ' +
      'icon gets a word next to it.',
    check: ({ src }) => {
      const lucide = lucideNames(src);
      return elements(src, ['Button', 'ExpandingIconButton'])
        .filter((el) => el.name === 'ExpandingIconButton' || ICON_SIZE.test(el.open))
        .flatMap((el) => {
          const out: Omit<Violation, 'file'>[] = [];
          const line = lineAt(src, el.index);
          for (const icon of iconsOf(el, lucide)) {
            if (!PLAIN_ICONS.has(icon)) out.push({ line, excerpt: `icon-only ${icon}` });
          }
          const labelled =
            el.name === 'ExpandingIconButton' ||
            /\baria-label=|className="sr-only"/.test(el.open + el.body);
          if (iconsOf(el, lucide).length > 0 && !labelled)
            out.push({ line, excerpt: 'icon-only button without aria-label' });
          return out;
        });
    },
  },
  {
    id: 'no-form-dialog',
    rule:
      'Adding and editing happen on a page. A dialog only confirms, or edits one field: it holds ' +
      'no form component and at most one field.',
    check: ({ src }) =>
      elements(src, ['DialogContent', 'SheetContent']).flatMap((el) => {
        const forms = [...el.body.matchAll(/<(form|[A-Z]\w*Form)(?=[\s/>])/g)].map((m) => m[1]);
        const fields = el.body.match(/<(?:Input|Textarea|SelectTrigger|Stepper)(?=[\s/>])/g) ?? [];
        if (forms.length === 0 && fields.length < 2) return [];
        const what = forms.length > 0 ? `<${forms[0]}>` : `${fields.length} fields`;
        return [{ line: lineAt(src, el.index), excerpt: `<${el.name}> holds ${what}` }];
      }),
  },
  {
    id: 'page-template',
    rule:
      'Every page uses one PageShell template (list, detail, form, dashboard) with a title; the ' +
      'old breadcrumb header goes away page by page in step 6.',
    check: ({ src }) =>
      elements(src, ['PageShell', 'PageSkeleton'])
        .filter((el) => !/\btemplate=/.test(el.open) || !/\btitle=/.test(el.open))
        .map((el) => ({
          line: lineAt(src, el.index),
          excerpt: `<${el.name}> without template and title`,
        })),
  },
];

export function runUiRules(files: Source[], rules: UiRule[] = UI_RULES): PatternResult[] {
  return rules.map((r) => ({
    id: r.id,
    rule: r.rule,
    violations: files.flatMap((f) => r.check(f).map((v) => ({ file: f.path, ...v }))),
  }));
}
