// Phase 8 C1: data/openjlpt/examples.json, the Vietnamese side of every OpenJLPT example sentence
// (docs/plans/2026-10-28-quick-review.md). Written once by an AI outside the app (Codex, batch by batch:
// docs/codex/2026-10-28-examples-brief.md) and checked here, so quick review can trust it: the web still
// never writes a sentence. The Japanese stays in source.json; this file only adds to it, keyed by id.
// No "@/" imports: scripts/openjlpt/examples-*.ts run this file directly with Node.
import type { OjEntry, OjSource } from './openjlpt.ts';

// Where the item stands in the sentence: each piece as its exact text (found left to right), or as
// [start, end) offsets in UTF-16 code units when the text alone would be ambiguous. A pattern split
// in two (しか…ない) has two pieces.
export type SpanPiece = string | [number, number];

export interface ExampleEntry {
  // The sentence in natural Vietnamese. Optional only when the sentence is skipped.
  vi?: string;
  span?: SpanPiece[];
  // Why the sentence is not fit to learn from (vulgar, figurative, honorific for a beginner word…).
  skip?: string;
  // Grammar only: the formation line in Vietnamese ("Noun + は" → "Danh từ + は").
  formationVi?: string;
}

export interface ExamplesFile {
  version: 1;
  entries: Record<string, ExampleEntry>;
}

export interface Span {
  start: number;
  end: number;
}

const VI_MAX = 300;
const FORMATION_MAX = 200;
// Kana or kanji left in a translation means something was not translated.
const JAPANESE = /[぀-ヿ㐀-鿿]/u;
const RUBY = /\{([^|{}]+)\|([^{}]+)\}/gu;

/** OpenJLPT furigana `{私|わたし}は` in the app's ruby markup `私[わたし]は`. */
export function rubyFromFurigana(furigana: string): string {
  return furigana.replace(RUBY, (_, text: string, reading: string) => `${text}[${reading}]`);
}

/** The furigana with its readings taken out, which must give back the sentence. */
export function plainFromFurigana(furigana: string): string {
  return furigana.replace(RUBY, (_, text: string) => text);
}

function occurrences(text: string, part: string, from: number): number[] {
  const at: number[] = [];
  for (let i = text.indexOf(part, from); i >= 0; i = text.indexOf(part, i + 1)) at.push(i);
  return at;
}

/** The pieces as offsets in the sentence, or the first reason they cannot be placed. */
export function resolveSpans(
  ja: string,
  pieces: readonly SpanPiece[],
): { ok: true; spans: Span[] } | { ok: false; error: string } {
  if (pieces.length === 0) return { ok: false, error: 'span rỗng' };
  const spans: Span[] = [];
  let from = 0;
  for (const piece of pieces) {
    if (typeof piece === 'string') {
      if (!piece) return { ok: false, error: 'span có mảnh rỗng' };
      const at = occurrences(ja, piece, from);
      if (at.length === 0)
        return { ok: false, error: `"${piece}" không có trong câu (sau vị trí ${from})` };
      if (at.length > 1) {
        return {
          ok: false,
          error: `"${piece}" xuất hiện ${at.length} lần từ vị trí ${from}; ghi [đầu, cuối] thay cho chữ`,
        };
      }
      spans.push({ start: at[0], end: at[0] + piece.length });
    } else {
      const [start, end] = piece;
      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < from ||
        end <= start ||
        end > ja.length
      ) {
        return { ok: false, error: `[${start}, ${end}] nằm ngoài câu hoặc chồng lên mảnh trước` };
      }
      spans.push({ start, end });
    }
    from = spans[spans.length - 1].end;
  }
  return { ok: true, spans };
}

/** Every OpenJLPT entry that has an example sentence, in source order. */
export function entriesWithExample(source: OjSource): OjEntry[] {
  return [...source.grammar, ...source.vocab].filter((e) => e.example?.ja);
}

export function checkEntry(entry: OjEntry, value: ExampleEntry): string[] {
  const errors: string[] = [];
  const ja = entry.example?.ja ?? '';
  const known = new Set(['vi', 'span', 'skip', 'formationVi']);
  for (const key of Object.keys(value)) if (!known.has(key)) errors.push(`khoá lạ "${key}"`);

  if (value.skip !== undefined && (typeof value.skip !== 'string' || !value.skip.trim())) {
    errors.push('skip phải là lý do (chuỗi không rỗng)');
  }
  const skipped = typeof value.skip === 'string' && value.skip.trim() !== '';

  if (value.vi === undefined) {
    if (!skipped) errors.push('thiếu vi');
  } else if (typeof value.vi !== 'string' || !value.vi.trim()) {
    errors.push('vi rỗng');
  } else {
    if (value.vi.length > VI_MAX) errors.push(`vi dài quá ${VI_MAX} ký tự`);
    if (JAPANESE.test(value.vi)) errors.push('vi còn chữ Nhật');
  }

  if (value.span === undefined) {
    if (!skipped) errors.push('thiếu span');
  } else if (!Array.isArray(value.span)) {
    errors.push('span phải là mảng');
  } else {
    const placed = resolveSpans(ja, value.span);
    if (!placed.ok) errors.push(placed.error);
  }

  const isGrammar = entry.id.startsWith('g:');
  if (value.formationVi !== undefined) {
    if (!isGrammar) errors.push('formationVi chỉ dành cho ngữ pháp');
    else if (typeof value.formationVi !== 'string' || !value.formationVi.trim()) {
      errors.push('formationVi rỗng');
    } else if (value.formationVi.length > FORMATION_MAX) {
      errors.push(`formationVi dài quá ${FORMATION_MAX} ký tự`);
    }
  } else if (isGrammar && entry.formation && !skipped) {
    errors.push('thiếu formationVi (mục có formation)');
  }
  return errors;
}

export interface ExamplesReport {
  errors: string[];
  done: number;
  skipped: number;
  missing: number;
  total: number;
}

export function checkExamples(source: OjSource, file: unknown): ExamplesReport {
  const all = entriesWithExample(source);
  const report: ExamplesReport = { errors: [], done: 0, skipped: 0, missing: 0, total: all.length };
  const shape = file as Partial<ExamplesFile> | null;
  if (
    !shape ||
    shape.version !== 1 ||
    typeof shape.entries !== 'object' ||
    shape.entries === null
  ) {
    report.errors.push('file phải có dạng {"version": 1, "entries": {…}}');
    report.missing = all.length;
    return report;
  }
  const entries = shape.entries;
  const byId = new Map(all.map((e) => [e.id, e]));
  for (const [id, value] of Object.entries(entries)) {
    const entry = byId.get(id);
    if (!entry) {
      report.errors.push(`${id}: không có mục nào có câu ví dụ mang id này`);
      continue;
    }
    if (typeof value !== 'object' || value === null) {
      report.errors.push(`${id}: giá trị phải là object`);
      continue;
    }
    for (const error of checkEntry(entry, value)) report.errors.push(`${id}: ${error}`);
    report.done++;
    if (value.skip) report.skipped++;
  }
  report.missing = all.filter((e) => !(e.id in entries)).length;
  return report;
}
