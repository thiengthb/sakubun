import { answerSurface, type ClozeExample } from '@/lib/domain/cloze';
import { isSplitPattern } from '@/lib/domain/quiz-class';
import { readAnalysis, type KaiwaToken } from '@/lib/kaiwa/furigana';
import { parseScript, plainJapanese } from '@/lib/kaiwa/parse';

// Lines of the learner's own Kaiwa scripts as example sentences for quick review
// (docs/plans/2026-10-28-quick-review.md, C5): a line already has its Vietnamese and, from the
// analysis saved with the script (K4), its furigana and words. Pure: no I/O.

export interface KaiwaLine {
  ja: string;
  vi: string;
  jaRuby: string;
  tokens: KaiwaToken[];
}

// At most this many lines per item, so a word the learner uses everywhere does not crowd out the
// sentences written for it.
export const MAX_KAIWA_EXAMPLES = 3;

/** The translated lines of the scripts whose analysis is current; the rest cannot be placed. */
export function kaiwaLines(
  scripts: readonly { body: string; analysis: string | null }[],
): KaiwaLine[] {
  return scripts.flatMap(({ body, analysis }) => {
    const lines = parseScript(body);
    const read = readAnalysis(analysis, lines.length);
    if (!read) return [];
    return lines.flatMap((line, i) => {
      const { ruby, tokens } = read.lines[i];
      const ja = plainJapanese(line.japanese);
      const vi = line.translation.trim();
      // The words must spell the line, or their offsets would point at the wrong text.
      if (!vi || tokens.map((t) => t.surface).join('') !== ja) return [];
      return [{ ja, vi, jaRuby: ruby, tokens }];
    });
  });
}

const norm = (text: string) => text.normalize('NFKC').trim();

// Where the item stands in the line: a word by its dictionary form (会い in 会いましょう is 会う), a
// pattern by its text when that appears exactly once.
function place(
  line: KaiwaLine,
  kind: string,
  expression: string,
): { start: number; end: number } | null {
  if (kind === 'VOCAB') {
    const word = norm(expression);
    let offset = 0;
    for (const token of line.tokens) {
      const start = offset;
      offset += token.surface.length;
      if (norm(token.base ?? token.surface) === word || norm(token.surface) === word) {
        return { start, end: offset };
      }
    }
    return null;
  }
  if (isSplitPattern(expression)) return null;
  const surface = answerSurface(expression);
  if ([...surface].length < 2) return null;
  const start = line.ja.indexOf(surface);
  if (start < 0 || line.ja.indexOf(surface, start + 1) >= 0) return null;
  return { start, end: start + surface.length };
}

export function kaiwaExamples(
  lines: readonly KaiwaLine[],
  item: { kind: string; expression: string },
): ClozeExample[] {
  const out: ClozeExample[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (out.length >= MAX_KAIWA_EXAMPLES) break;
    if (seen.has(line.ja)) continue;
    const span = place(line, item.kind, item.expression);
    if (!span) continue;
    seen.add(line.ja);
    out.push({ ja: line.ja, vi: line.vi, jaRuby: line.jaRuby, spans: [span] });
  }
  return out;
}
