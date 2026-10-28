'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorState, RangeSetBuilder, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as emptyText,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { autocompletion, type CompletionContext } from '@codemirror/autocomplete';
import { linter, type Diagnostic } from '@codemirror/lint';
import { scriptSpeakers } from '@/lib/kaiwa/layout';
import { checkBody, parseScript } from '@/lib/kaiwa/parse';
import { rowParts, speakerPrefix, type PartKind } from '@/lib/kaiwa/syntax';

// The script editor (thien, 7.4f, after the old canvas's CodeMirror): line numbers, the current row
// lit, undo and redo, Ctrl F to find and replace, several cursors (Alt click, Ctrl D), the format in
// colour, the speakers already used offered at the start of a row, and the save's own checks as
// wavy lines on their row. Ctrl S saves; nothing saves by itself.

const MARKS: Record<PartKind, Decoration> = {
  speaker: Decoration.mark({ class: 'cm-kw-speaker' }),
  bar: Decoration.mark({ class: 'cm-kw-bar' }),
  translation: Decoration.mark({ class: 'cm-kw-vi' }),
  reading: Decoration.mark({ class: 'cm-kw-reading' }),
};

function paint(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to;) {
      const line = view.state.doc.lineAt(pos);
      const parts = rowParts(line.text).sort((a, b) => a.from - b.from);
      for (const p of parts) builder.add(line.from + p.from, line.from + p.to, MARKS[p.kind]);
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const colours = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = paint(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = paint(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);

function speakers(context: CompletionContext) {
  const line = context.state.doc.lineAt(context.pos);
  const typed = speakerPrefix(line.text.slice(0, context.pos - line.from));
  if (typed === null || (!typed && !context.explicit)) return null;
  const names = scriptSpeakers(parseScript(context.state.doc.toString()));
  const options = names
    .filter((n) => n.startsWith(typed))
    .map((n) => ({ label: n, apply: `${n}: `, type: 'variable', detail: 'người nói' }));
  if (options.length === 0) return null;
  return { from: context.pos - typed.length, options };
}

const checks = linter(
  (view) => {
    const doc = view.state.doc;
    const out: Diagnostic[] = [];
    for (const p of checkBody(doc.toString())) {
      if (p.row === null || p.row > doc.lines) continue;
      const line = doc.line(p.row);
      out.push({ from: line.from, to: line.to, severity: 'error', message: p.message });
    }
    return out;
  },
  { delay: 300 },
);

// Colours from the app's tokens, so the editor follows light and dark.
const look = EditorView.theme({
  '&': {
    fontSize: '15px',
    backgroundColor: 'var(--card)',
    color: 'var(--foreground)',
    height: '100%',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.7' },
  '.cm-content': { caretColor: 'var(--foreground)', padding: '8px 0' },
  '.cm-gutters': {
    backgroundColor: 'var(--card)',
    color: 'var(--muted-foreground)',
    borderRight: '1px solid var(--border)',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in oklch, var(--muted), transparent 40%)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--muted)', color: 'var(--foreground)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in oklch, var(--accent-brand), transparent 75%) !important',
  },
  '.cm-kw-speaker': { color: 'var(--accent-brand)', fontWeight: '600' },
  '.cm-kw-bar': { color: 'var(--muted-foreground)' },
  '.cm-kw-vi': { color: 'var(--muted-foreground)' },
  '.cm-kw-reading': { color: 'var(--info)' },
  '.cm-panels': { backgroundColor: 'var(--muted)', color: 'var(--foreground)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
  },
});

// The editor's own words in Vietnamese (search panel, lint, completion).
const PHRASES = EditorState.phrases.of({
  Find: 'Tìm',
  Replace: 'Thay bằng',
  next: 'sau',
  previous: 'trước',
  all: 'tất cả',
  'match case': 'phân biệt hoa thường',
  regexp: 'biểu thức chính quy',
  'by word': 'cả từ',
  replace: 'thay',
  'replace all': 'thay hết',
  close: 'đóng',
  'Go to line': 'Tới dòng',
  go: 'tới',
  Diagnostics: 'Lỗi',
  'No diagnostics': 'Không có lỗi',
});

export interface EditorStatus {
  row: number;
  column: number;
}

export function ScriptEditor({
  initial,
  onChange,
  onSave,
  onCursor,
  editorRef,
  label = 'Kịch bản',
  placeholder,
}: {
  initial: string;
  onChange: (body: string) => void;
  onSave: () => void;
  onCursor?: (status: EditorStatus) => void;
  /** The view, for the phone's key row and the preview's jump to a row. */
  editorRef?: React.RefObject<EditorView | null>;
  label?: string;
  placeholder?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  // The latest handlers, read by the editor without rebuilding it.
  const handlers = useRef({ onChange, onSave, onCursor });
  useEffect(() => {
    handlers.current = { onChange, onSave, onCursor };
  });
  const [initialDoc] = useState(initial);

  useEffect(() => {
    if (!host.current) return;
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      drawSelection(),
      EditorState.allowMultipleSelections.of(true),
      EditorView.clickAddsSelectionRange.of((e) => e.altKey),
      EditorView.lineWrapping,
      search({ top: true }),
      highlightSelectionMatches(),
      autocompletion({ override: [speakers], icons: false }),
      checks,
      colours,
      look,
      PHRASES,
      keymap.of([
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            handlers.current.onSave();
            return true;
          },
        },
        ...searchKeymap,
        ...historyKeymap,
        ...defaultKeymap,
      ]),
      EditorView.contentAttributes.of({ 'aria-label': label, lang: 'ja', spellcheck: 'false' }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) handlers.current.onChange(u.state.doc.toString());
        if (u.docChanged || u.selectionSet) {
          const head = u.state.selection.main.head;
          const line = u.state.doc.lineAt(head);
          handlers.current.onCursor?.({ row: line.number, column: head - line.from + 1 });
        }
      }),
    ];
    if (placeholder) extensions.push(emptyText(placeholder));
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({ doc: initialDoc, extensions }),
    });
    if (editorRef) editorRef.current = view;
    return () => {
      view.destroy();
      if (editorRef) editorRef.current = null;
    };
  }, [initialDoc, label, placeholder, editorRef]);

  return <div ref={host} data-slot="script-editor" className="h-full min-h-0" />;
}
