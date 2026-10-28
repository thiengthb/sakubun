import type { KaiwaToken } from '@/lib/kaiwa/furigana';

// Which words of a sentence are worth a lookup, and by what form (phase 8, K5; every sentence since
// 7.4b, lib/japanese/sentence-words.ts). Pure: the meanings come from lib/kaiwa/lookup.ts.

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
