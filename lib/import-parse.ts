// Permissive parser for pasted grammar-pattern lists (formats vary wildly by hand-copy source).
// Every entry is a grammar pattern — sakubun no longer has a vocabulary dimension (2026-07-07).
// Two shapes are recognized per line:
//   1. Table row (Excel download / spreadsheet copy): pattern ⇥ phonetic ⇥ mean ⇥ comment
//   2. Free-form: "pattern (reading) : meaning [N5]" with flexible separators.

export interface ParsedEntry {
  expression: string;
  reading?: string;
  meaningVi: string;
  level?: string;
  notes?: string;
}

export interface ParseResult {
  entries: ParsedEntry[];
  errors: { line: number; text: string; reason: string }[];
}

const LEVEL_RE = /\b(N[1-5])\b/i;
// Meaning separators, tried in order (tab first — spreadsheet paste).
const SEPARATORS = ['\t', '：', ' : ', ': ', '⇒', '→', ' — ', ' - ', '；'];
const READING_RE = /[（(]([ぁ-ゖー・\s]+)[）)]/;

// Mazii dictionary rows dump every sense ("con người; nhân loại; người; …" — 20+ for common
// words). Keep the first few senses for the SRS card; the tail is synonym noise.
const MAX_SENSES = 4;

export function condenseMeaning(mean: string): string {
  const senses = mean
    .split(/[;；]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = [...new Set(senses)];
  const kept = unique.slice(0, MAX_SENSES).join('; ');
  return unique.length > MAX_SENSES ? `${kept}…` : kept;
}

const MAZII_HEADER_RE = /^(word|từ|tu)\b/i;

/** Build an entry from Mazii's 4 columns (word / phonetic / mean / comment). */
export function maziiEntry(
  word: string,
  phonetic: string,
  mean: string,
  comment?: string,
): ParsedEntry | null {
  const expression = word.trim();
  const meaningVi = condenseMeaning(mean ?? '');
  if (!expression || !meaningVi) return null;
  let level: string | undefined;
  const levelMatch = (comment ?? '').match(LEVEL_RE);
  if (levelMatch) level = levelMatch[1].toUpperCase();
  return {
    expression,
    reading: phonetic?.trim() || undefined,
    meaningVi,
    level,
    notes: comment?.trim() || undefined,
  };
}

function splitOnce(line: string): [string, string] | null {
  for (const sep of SEPARATORS) {
    const at = line.indexOf(sep);
    if (at > 0) return [line.slice(0, at), line.slice(at + sep.length)];
  }
  return null;
}

export function parseImportText(text: string): ParseResult {
  const result: ParseResult = { entries: [], errors: [] };

  text.split(/\r?\n/).forEach((raw, index) => {
    // Mazii table row (Excel/spreadsheet copy): word ⇥ phonetic ⇥ mean ⇥ comment.
    const cells = raw.split('\t').map((c) => c.trim());
    if (cells.length >= 3) {
      if (MAZII_HEADER_RE.test(cells[0])) return; // header row
      const entry = maziiEntry(cells[0], cells[1], cells[2], cells[3]);
      if (entry) result.entries.push(entry);
      else if (cells.some(Boolean))
        result.errors.push({
          line: index + 1,
          text: raw.trim(),
          reason: 'dòng bảng Mazii thiếu từ hoặc thiếu nghĩa',
        });
      return;
    }

    const withoutBullet = raw.trim().replace(/^[-•*\d.)\s]+(?=\S)/, '');
    if (!withoutBullet) return;

    let line = withoutBullet;
    let level: string | undefined;
    const levelMatch = line.match(LEVEL_RE);
    if (levelMatch) {
      level = levelMatch[1].toUpperCase();
      line = line.replace(levelMatch[0], '').trim();
    }

    const parts = splitOnce(line);
    if (!parts) {
      result.errors.push({
        line: index + 1,
        text: withoutBullet,
        reason: 'không tìm thấy dấu phân cách nghĩa (thử ":", "：" hoặc tab)',
      });
      return;
    }

    let [head, meaning] = parts;
    meaning = meaning.trim().replace(/^[:：\s]+/, '');
    let reading: string | undefined;
    const readingMatch = head.match(READING_RE);
    if (readingMatch) {
      reading = readingMatch[1].trim();
      head = head.replace(readingMatch[0], '');
    }
    const expression = head.trim();
    if (!expression || !meaning) {
      result.errors.push({
        line: index + 1,
        text: withoutBullet,
        reason: 'thiếu từ hoặc thiếu nghĩa',
      });
      return;
    }

    result.entries.push({
      expression,
      reading,
      meaningVi: meaning,
      level,
    });
  });

  return result;
}
