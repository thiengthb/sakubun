import type { KaiwaToken } from '@/lib/kaiwa/furigana';
import { lookupKey } from '@/lib/kaiwa/words';

// The words of any Japanese sentence on a page, for the hover lookup everywhere (thien, 7.4b). Pure:
// the tokenizer runs on the server (lib/kaiwa/tokenizer.ts), the page maps these offsets onto its
// own text nodes (components/common/word-lookup.tsx).

/** Sentences per lookup call: a page with more sends them in a few calls. */
export const LOOKUP_BATCH = 60;

export interface SentenceWord {
  /** UTF-16 offsets into the sentence as the page shows it, readings left out. */
  start: number;
  end: number;
  /** What the meaning is looked up by: the dictionary form (会い -> 会う). */
  key: string;
}

export function sentenceWords(text: string, tokens: readonly KaiwaToken[]): SentenceWord[] {
  const words: SentenceWord[] = [];
  let at = 0;
  for (const token of tokens) {
    // The tokenizer keeps every character, but should a token not sit where expected, find it.
    const start = text.startsWith(token.surface, at) ? at : text.indexOf(token.surface, at);
    if (start === -1) continue;
    const end = start + token.surface.length;
    at = end;
    const key = lookupKey(token);
    if (key) words.push({ start, end, key });
  }
  return words;
}

/** One run of the sentence's text: a text node on the page, possibly kept from the lookup. */
export interface TextRun {
  length: number;
  /** Text the learner must not be told yet, such as Ôn nhanh's target before the answer. */
  hidden?: boolean;
}

export interface WordPiece {
  run: number;
  start: number;
  end: number;
}

// Where a word lies in the page's text runs, one piece per run it touches (a reading's base and the
// kana after it are two runs, so the reading between them is never part of the word). Null when the
// word touches hidden text or runs past the end.
export function wordPieces(runs: readonly TextRun[], word: SentenceWord): WordPiece[] | null {
  const pieces: WordPiece[] = [];
  let offset = 0;
  for (let run = 0; run < runs.length && offset < word.end; run++) {
    const length = runs[run].length;
    const from = Math.max(word.start, offset);
    const to = Math.min(word.end, offset + length);
    if (from < to) {
      if (runs[run].hidden) return null;
      pieces.push({ run, start: from - offset, end: to - offset });
    }
    offset += length;
  }
  return offset >= word.end ? pieces : null;
}
