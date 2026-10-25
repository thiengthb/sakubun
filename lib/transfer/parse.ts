import { ITEM_LIMITS, itemLimitError } from '@/lib/library/item-limits';
import { textLength } from '@/lib/library/group-limits';

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
const SEPARATORS = ['\t', '：', ' : ', ': ', '⇒', '→', ' — ', ' - ', '；'];
const READING_RE = /[（(]([ぁ-ゖー・\s]+)[）)]/;

const MAX_SENSES = 4;

/**
 * A dictionary meaning cut to a gloss: at most 4 unique senses, and only as many whole senses as
 * fit the meaning limit (ITEM_LIMITS.meaningVi, with the "…" that marks a cut). A first sense
 * longer than the limit is kept whole, so the row reports the limit instead of losing words.
 */
export function condenseMeaning(mean: string): string {
  const senses = mean
    .split(/[;；]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = [...new Set(senses)];
  const kept: string[] = [];
  for (const sense of unique.slice(0, MAX_SENSES)) {
    const next = [...kept, sense].join('; ');
    const cut = kept.length + 1 < unique.length;
    if (kept.length > 0 && textLength(next) + (cut ? 1 : 0) > ITEM_LIMITS.meaningVi) break;
    kept.push(sense);
  }
  return kept.length < unique.length ? `${kept.join('; ')}…` : kept.join('; ');
}

/** The reason a parsed row cannot be added, or null. Same rule addItems enforces on the server. */
export function entryLimitReason(entry: ParsedEntry): string | null {
  return itemLimitError(entry)?.message ?? null;
}

const MAZII_HEADER_RE = /^(word|từ|tu)\b/i;

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
    const cells = raw.split('\t').map((c) => c.trim());
    if (cells.length >= 3) {
      if (MAZII_HEADER_RE.test(cells[0])) return; // header row
      const entry = maziiEntry(cells[0], cells[1], cells[2], cells[3]);
      const tooLong = entry && entryLimitReason(entry);
      if (tooLong) result.errors.push({ line: index + 1, text: raw.trim(), reason: tooLong });
      else if (entry) result.entries.push(entry);
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

    const entry = { expression, reading, meaningVi: meaning, level };
    const tooLong = entryLimitReason(entry);
    if (tooLong) {
      result.errors.push({ line: index + 1, text: withoutBullet, reason: tooLong });
      return;
    }
    result.entries.push(entry);
  });

  return result;
}
