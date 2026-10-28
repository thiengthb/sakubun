import type { UserDb } from '@/lib/db/user-db';
import { lookupWords, type WordMeaning } from '@/lib/kaiwa/lookup';
import { japaneseTokenizer } from '@/lib/kaiwa/tokenizer';
import { sentenceWords, type SentenceWord } from '@/lib/japanese/sentence-words';

// The hover lookup's server side (thien, 7.4b): a page sends the Japanese sentences it shows, gets
// back their words that have a meaning, and the meanings, in one call. Each sentence is tokenized
// once per process: the same History, Ôn nhanh and example sentences come back again and again.

const CACHE_SIZE = 5000;
const cache = new Map<string, SentenceWord[]>();

function remember(text: string, words: SentenceWord[]) {
  cache.delete(text);
  cache.set(text, words);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
}

async function wordsOf(texts: readonly string[]): Promise<Map<string, SentenceWord[]>> {
  const out = new Map<string, SentenceWord[]>();
  const missing: string[] = [];
  for (const text of texts) {
    const hit = cache.get(text);
    if (hit) {
      remember(text, hit);
      out.set(text, hit);
    } else missing.push(text);
  }
  if (missing.length > 0) {
    const tokenize = await japaneseTokenizer();
    for (const text of missing) {
      const words = sentenceWords(text, tokenize(text));
      remember(text, words);
      out.set(text, words);
    }
  }
  return out;
}

export interface SentenceLookup {
  /** Per sentence, only the words with a meaning. */
  words: Record<string, SentenceWord[]>;
  meanings: Record<string, WordMeaning>;
}

export async function lookupSentences(
  db: UserDb,
  texts: readonly string[],
): Promise<SentenceLookup> {
  const all = await wordsOf(texts);
  const keys = [...new Set([...all.values()].flatMap((words) => words.map((w) => w.key)))];
  const meanings = await lookupWords(db, keys);
  const words: Record<string, SentenceWord[]> = {};
  for (const [text, list] of all) words[text] = list.filter((w) => w.key in meanings);
  return { words, meanings };
}
