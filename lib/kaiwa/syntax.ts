import { speakerLabel } from '@/lib/kaiwa/parse';

// How the editor colours a row of a script (thien, 7.4f): the speaker's label, the bar, the
// Vietnamese after it, and the `[よみ]` of a manual reading; the Japanese keeps the text colour.
// The same reading of a row as parseScript, so a colour never promises what a save won't do.
// Pure: offsets are UTF-16, as the editor counts them.

export type PartKind = 'speaker' | 'bar' | 'translation' | 'reading';

export interface RowPart {
  from: number;
  to: number;
  kind: PartKind;
}

const LABELLED = /^(\s*)(\*\*)?([^:：|｜]{1,24}?)([:：])(\*\*)?\s*/;
const SIDE_LABEL = /^(Tiếng Việt|Vietnamese|Nghĩa|Romaji)$/i;

export function rowParts(row: string): RowPart[] {
  const parts: RowPart[] = [];
  let at = 0;
  const label = row.match(LABELLED);
  if (label) {
    const name = label[3];
    const marked = !!label[2];
    // The older Markdown style's side rows (**Tiếng Việt:** …) read as the translation.
    if (marked && SIDE_LABEL.test(name.trim())) {
      return [{ from: 0, to: row.length, kind: 'translation' }];
    }
    if (speakerLabel(name) !== null && (!marked || label[5])) {
      at = label[0].length;
      parts.push({ from: label[1].length, to: at, kind: 'speaker' });
    }
  }
  const bar = row.slice(at).search(/[|｜]/);
  const japaneseEnd = bar < 0 ? row.length : at + bar;
  for (const m of row.slice(at, japaneseEnd).matchAll(/\[[^\]\n]*\]/g)) {
    parts.push({ from: at + m.index, to: at + m.index + m[0].length, kind: 'reading' });
  }
  if (bar >= 0) {
    parts.push({ from: japaneseEnd, to: japaneseEnd + 1, kind: 'bar' });
    if (japaneseEnd + 1 < row.length) {
      parts.push({ from: japaneseEnd + 1, to: row.length, kind: 'translation' });
    }
  }
  return parts;
}

/** The speaker typed so far at the start of a row, when the cursor is still in it. */
export function speakerPrefix(beforeCursor: string): string | null {
  const m = beforeCursor.match(/^\s*([^\s:：|｜[\]]*)$/);
  return m ? m[1] : null;
}
