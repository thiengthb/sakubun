// KJ1b (docs/plans/2026-11-08-kanji.md): the short Vietnamese meaning of each Jōyō kanji, written in
// batches outside the app (docs/codex/2026-11-08-kanji-meanings-brief.md) into
// data/kanji/meanings-vi.json, one `"kanji": "meaning"` per line. Pure: the files in, a report out.

/** At most this many senses, split by "; ". */
export const MAX_SENSES = 3;
export const MAX_LENGTH = 60;
const VIETNAMESE_MARK = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const KANA_OR_KANJI = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/u;

export interface MeaningsReport {
  errors: string[];
  done: number;
  missing: number;
  total: number;
}

/** Why one meaning breaks the brief's rules, or null when it is fine. */
export function meaningProblem(meaning: unknown): string | null {
  if (typeof meaning !== 'string' || !meaning.trim()) return 'nghĩa trống';
  if (meaning !== meaning.trim()) return 'có khoảng trắng thừa ở đầu hoặc cuối';
  if (meaning.length > MAX_LENGTH) return `dài quá ${MAX_LENGTH} ký tự`;
  const senses = meaning.split('; ');
  if (senses.length > MAX_SENSES) return `quá ${MAX_SENSES} nghĩa`;
  if (senses.some((s) => !s.trim())) return 'có nghĩa trống giữa hai dấu ;';
  if (/[.;]$/.test(meaning)) return 'không kết thúc bằng dấu chấm hay chấm phẩy';
  // Japanese only inside parentheses, as a word to show the sense: "cơm hộp (弁当)".
  if (KANA_OR_KANJI.test(meaning.replace(/\([^)]*\)/g, ''))) return 'có chữ Nhật ngoài ngoặc';
  if (/[A-Za-z]/.test(meaning) && !VIETNAMESE_MARK.test(meaning)) return 'có vẻ là tiếng Anh';
  return null;
}

export function checkMeanings(kanji: readonly string[], file: unknown): MeaningsReport {
  const total = kanji.length;
  if (!file || typeof file !== 'object' || Array.isArray(file))
    return { errors: ['file phải là một object {chữ: nghĩa}'], done: 0, missing: total, total };
  const known = new Set(kanji);
  const errors: string[] = [];
  let done = 0;
  for (const [k, meaning] of Object.entries(file)) {
    if (!known.has(k)) {
      errors.push(`${k}: không phải chữ Jōyō trong data/kanji/kanji.json`);
      continue;
    }
    const problem = meaningProblem(meaning);
    if (problem) errors.push(`${k}: ${problem}`);
    else done++;
  }
  return { errors, done, missing: total - done, total };
}

/** The file as it is committed: one kanji per line, in the order of kanji.json. */
export function formatMeanings(kanji: readonly string[], meanings: Record<string, string>): string {
  const lines = kanji
    .filter((k) => k in meanings)
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(meanings[k])}`);
  return lines.length ? `{\n${lines.join(',\n')}\n}\n` : '{}\n';
}
