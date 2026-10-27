import { parseFurigana } from '@/lib/japanese/furigana';

// The Kaiwa script format, from the old kaiwa-canvas app (phase 8 plan), kept as is so its scripts
// and prompts still work:
//   A: 日本語 | tiếng Việt     a line of dialogue (speaker label, Japanese, Vietnamese)
//   日本語 | tiếng Việt        a line of monologue
//   A: 日本語                  no translation yet
//   **C:** 日本語              the older Markdown style, its Vietnamese on the next row:
//   **Tiếng Việt:** …
// Manual furigana is `漢字[かんじ]`, the markup parseFurigana reads. Pure: no I/O.

export interface ScriptLine {
  speaker: string | null;
  japanese: string;
  translation: string;
  // 1-based row in the raw text where the Japanese is, for error messages and editing.
  row: number;
}

const LATIN_LABEL = /^[A-Za-z][A-Za-z .'-]{0,23}$/;
const JAPANESE_LABEL = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー・]{1,8}$/u;
const TRANSLATION_LABEL = /^(Tiếng Việt|Vietnamese|Nghĩa)$/i;
const SKIPPED_LABEL = /^Romaji$/i;
const JAPANESE_CHAR = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

// Latin names become one or two letters (Tanaka -> Ta), as the old app showed them; a Japanese
// name (田中) is kept. Anything else (10 in "10:30に…") is not a speaker.
export function speakerLabel(raw: string): string | null {
  const label = raw.trim();
  if (JAPANESE_LABEL.test(label)) return label;
  if (!LATIN_LABEL.test(label)) return null;
  const letters = [...label].filter((c) => /[A-Za-z]/.test(c));
  const [first, second] = letters;
  return second ? `${first.toUpperCase()}${second.toLowerCase()}` : first.toUpperCase();
}

// Japanese and Vietnamese are split at the first bar; a full-width one counts too.
function splitTranslation(text: string): { japanese: string; translation: string } {
  const at = text.search(/[|｜]/);
  if (at < 0) return { japanese: text.trim(), translation: '' };
  return { japanese: text.slice(0, at).trim(), translation: text.slice(at + 1).trim() };
}

export function parseScript(raw: string): ScriptLine[] {
  const lines: ScriptLine[] = [];
  let pending: ScriptLine | null = null;
  raw.split(/\r?\n/).forEach((text, index) => {
    const row = text.trim();
    if (!row) return;

    const markdown = row.match(/^\*\*(.+?)[:：]\*\*\s*(.*)$/);
    if (markdown && (TRANSLATION_LABEL.test(markdown[1]) || SKIPPED_LABEL.test(markdown[1]))) {
      if (pending && TRANSLATION_LABEL.test(markdown[1]) && !pending.translation) {
        pending.translation = markdown[2].trim();
      }
      return;
    }

    const labelled = markdown ?? row.match(/^([^:：|｜]{1,24})[:：]\s*(.+)$/);
    const speaker = labelled ? speakerLabel(labelled[1]) : null;
    const rest = labelled && speaker ? labelled[2] : row;
    pending = { speaker, ...splitTranslation(rest), row: index + 1 };
    lines.push(pending);
  });
  return lines;
}

export const SCRIPT_LIMITS = {
  title: 80,
  body: 20_000,
  lines: 300,
  japanese: 200,
} as const;

export interface ScriptProblem {
  row: number | null;
  message: string;
}

const SHOWN_PROBLEMS = 5;

// What a save refuses, each with one way to fix it. A script is saved whole or not at all, so the
// learner (or their AI) never ends up with half a script.
export function checkScript(title: string, body: string): ScriptProblem[] {
  const problems: ScriptProblem[] = [];
  const name = title.trim();
  if (!name) problems.push({ row: null, message: 'Thiếu tiêu đề. Đặt một tiêu đề ngắn.' });
  if (name.length > SCRIPT_LIMITS.title) {
    problems.push({
      row: null,
      message: `Tiêu đề dài quá ${SCRIPT_LIMITS.title} ký tự. Rút ngắn tiêu đề.`,
    });
  }
  if (body.length > SCRIPT_LIMITS.body) {
    problems.push({
      row: null,
      message: `Kịch bản dài quá ${SCRIPT_LIMITS.body} ký tự. Tách thành nhiều kịch bản.`,
    });
    return problems;
  }

  const lines = parseScript(body);
  if (lines.length === 0) {
    problems.push({
      row: null,
      message: 'Kịch bản trống. Thêm ít nhất một dòng dạng "A: 日本語 | tiếng Việt".',
    });
  }
  if (lines.length > SCRIPT_LIMITS.lines) {
    problems.push({
      row: null,
      message: `Kịch bản có hơn ${SCRIPT_LIMITS.lines} dòng. Tách thành nhiều kịch bản.`,
    });
  }
  for (const line of lines) {
    if (!JAPANESE_CHAR.test(line.japanese)) {
      problems.push({
        row: line.row,
        message: 'Không có chữ Nhật. Mỗi dòng là "A: 日本語 | tiếng Việt"; bỏ tiêu đề, romaji.',
      });
    } else if (line.japanese.length > SCRIPT_LIMITS.japanese) {
      problems.push({
        row: line.row,
        message: `Câu dài quá ${SCRIPT_LIMITS.japanese} ký tự. Tách thành nhiều dòng.`,
      });
    } else if (/[[\]]/.test(furiganaLeftover(line.japanese))) {
      problems.push({
        row: line.row,
        message: 'Furigana sai chỗ. Viết cách đọc ngay sau chữ Hán: 料理[りょうり].',
      });
    }
  }
  return problems;
}

// The text parseFurigana leaves outside furigana: a bracket left here was not read as a reading.
function furiganaLeftover(japanese: string): string {
  return parseFurigana(japanese)
    .filter((s) => !s.reading)
    .map((s) => s.text)
    .join('');
}

export function describeProblems(problems: readonly ScriptProblem[]): string {
  const shown = problems
    .slice(0, SHOWN_PROBLEMS)
    .map((p) => (p.row ? `Dòng ${p.row}: ${p.message}` : p.message));
  const more = problems.length - SHOWN_PROBLEMS;
  return [...shown, ...(more > 0 ? [`Và ${more} lỗi khác.`] : [])].join('\n');
}

// Line endings and trailing spaces do not count as a change; everything else is kept as written.
export function normalizeBody(body: string): string {
  return body
    .split(/\r?\n/)
    .map((row) => row.trimEnd())
    .join('\n')
    .trim();
}

// What text-to-speech reads and a copy takes: the Japanese without its `[よみ]` readings.
export function plainJapanese(japanese: string): string {
  return parseFurigana(japanese)
    .map((s) => s.text)
    .join('');
}
