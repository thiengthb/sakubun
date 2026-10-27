import { parseFurigana } from '@/lib/japanese/furigana';
import type { KaiwaToken } from '@/lib/kaiwa/furigana';

// Words in a Kaiwa line for the hover lookup (phase 8, K5). Pure: the meanings come from
// lib/kaiwa/lookup.ts.

// Parts of speech worth a lookup; particles, auxiliaries and punctuation are not.
const CONTENT_POS = new Set(['名詞', '動詞', '形容詞', '副詞', '連体詞', '感動詞', '接続詞']);

// The form a word is looked up by: its dictionary form (会い -> 会う), else as written.
export function lookupKey(token: KaiwaToken): string | null {
  if (!token.pos || !CONTENT_POS.has(token.pos)) return null;
  if (!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(token.surface)) return null;
  return token.base ?? token.surface;
}

export function lookupKeys(tokens: readonly KaiwaToken[]): string[] {
  return [...new Set(tokens.map(lookupKey).filter((k): k is string => k !== null))];
}

export interface WordGroup {
  // Characters (code points) of the line the group covers.
  length: number;
  // Indexes into the line's tokens.
  tokens: number[];
}

const chars = (text: string) => [...text].length;

// The line's words, cut where the furigana allows: a word ends where its token ends, except inside a
// reading, which is never split (an author's 何名様[なんめいさま] over 何 / 名 / 様 is one group).
// Plain text splits anywhere, so 静[しず]かだった is 静か, だっ, た. Null when the words do not spell
// the ruby's text.
export function wordGroups(ruby: string, tokens: readonly KaiwaToken[]): WordGroup[] | null {
  const segments = parseFurigana(ruby);
  if (
    tokens.length === 0 ||
    tokens.map((t) => t.surface).join('') !== segments.map((s) => s.text).join('')
  ) {
    return null;
  }
  const insideReading = new Set<number>();
  let at = 0;
  for (const segment of segments) {
    const n = chars(segment.text);
    if (segment.reading) for (let p = at + 1; p < at + n; p++) insideReading.add(p);
    at += n;
  }

  const groups: WordGroup[] = [];
  let current: WordGroup = { length: 0, tokens: [] };
  tokens.forEach((token, i) => {
    current.length += chars(token.surface);
    current.tokens.push(i);
    const end = groups.reduce((n, g) => n + g.length, 0) + current.length;
    if (!insideReading.has(end)) {
      groups.push(current);
      current = { length: 0, tokens: [] };
    }
  });
  return groups;
}

// What a group is looked up by, best first: the whole group when it holds several words (an author's
// 何名様 over 何 / 名 / 様), then each of its words.
export function groupKeys(group: WordGroup, tokens: readonly KaiwaToken[]): string[] {
  const words = group.tokens.map((i) => tokens[i]);
  const keys = words.map(lookupKey).filter((k): k is string => k !== null);
  if (keys.length === 0) return [];
  const whole = words.map((t) => t.surface).join('');
  return [...new Set(words.length > 1 ? [whole, ...keys] : keys)];
}
