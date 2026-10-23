import type { ItemKind } from '@/lib/library/item-kinds';
import { normalizeExpression, stripDecoration } from '@/lib/core/normalize';
import { markSpan, type Segment } from '@/lib/domain/sentence';
import { JLPT_LEVELS } from '@/lib/settings/schema';

// A fill-in-the-blank card for quick review, built without any AI (the WordQuiz algorithm): blank the
// item out of one of its example sentences and offer it among three other items of the same kind,
// nearest JLPT level first. Only sentences that can be blanked unambiguously are used, so there is
// exactly one right choice and the sentence never shows the answer. Same seed, same card.

export const CLOZE_CHOICES = 4;
export const BLANK = '（　）';

// WordQuiz bounds: shorter sentences give too little context, longer ones do not fit a phone card.
const MIN_SENTENCE = 6;
const MAX_SENTENCE = 90;
// A one-character answer (は, に, 木) matches too many places to blank deterministically.
const MIN_ANSWER = 2;

export interface ClozeItem {
  id: string;
  kind: ItemKind;
  expression: string;
  reading: string | null;
  level: string;
}

export interface ClozeExample {
  ja: string;
  vi?: string | null;
  // 漢字[かな] markup, as stored in enrichment examples.
  jaRuby?: string | null;
}

export interface ClozeChoice {
  itemId: string;
  expression: string;
  reading: string | null;
}

export interface Cloze {
  itemId: string;
  // The sentence with the item blanked, as plain text and as pieces with furigana.
  prompt: string;
  sentence: Segment[];
  translation: string | null;
  choices: ClozeChoice[];
  answerIndex: number;
}

// What gets blanked: the expression without the 〜 and brackets that decorate grammar patterns.
export function answerSurface(expression: string): string {
  return stripDecoration(expression.normalize('NFKC'));
}

function occurrences(text: string, part: string): number {
  let count = 0;
  for (let at = text.indexOf(part); at >= 0; at = text.indexOf(part, at + part.length)) count++;
  return count;
}

export function canBlank(surface: string, ja: string): boolean {
  const length = [...ja].length;
  return (
    [...surface].length >= MIN_ANSWER &&
    length >= MIN_SENTENCE &&
    length <= MAX_SENTENCE &&
    occurrences(ja, surface) === 1
  );
}

function levelDistance(a: string, b: string): number {
  const ia = JLPT_LEVELS.indexOf(a as (typeof JLPT_LEVELS)[number]);
  const ib = JLPT_LEVELS.indexOf(b as (typeof JLPT_LEVELS)[number]);
  return ia < 0 || ib < 0 ? JLPT_LEVELS.length : Math.abs(ia - ib);
}

// mulberry32: a small seeded generator, so a card can be rebuilt identically when it is graded.
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(input: readonly T[], rand: () => number): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Three items of the same kind that cannot also be right: not the same word, not sharing text with
// the answer (約束 / 約束する), and not already standing in the sentence.
function pickDistractors(
  target: ClozeItem,
  prompt: string,
  pool: readonly ClozeItem[],
  rand: () => number,
): ClozeItem[] {
  const answer = normalizeExpression(target.expression);
  const seen = new Set<string>([answer]);
  const usable: ClozeItem[] = [];
  for (const item of shuffled(pool, rand)) {
    if (item.id === target.id || item.kind !== target.kind) continue;
    const key = normalizeExpression(item.expression);
    const surface = answerSurface(item.expression);
    if (!key || !surface || seen.has(key)) continue;
    if (key.includes(answer) || answer.includes(key) || prompt.includes(surface)) continue;
    seen.add(key);
    usable.push(item);
  }
  // Stable sort keeps the shuffled order inside each level band.
  return usable
    .sort((a, b) => levelDistance(a.level, target.level) - levelDistance(b.level, target.level))
    .slice(0, CLOZE_CHOICES - 1);
}

export function buildCloze(input: {
  target: ClozeItem;
  examples: readonly ClozeExample[];
  pool: readonly ClozeItem[];
  seed: number;
}): Cloze | null {
  const { target, examples, pool, seed } = input;
  const surface = answerSurface(target.expression);
  const usable = examples.filter((e) => canBlank(surface, e.ja.trim()));
  if (usable.length === 0) return null;
  const rand = seeded(seed);
  const example = usable[Math.floor(rand() * usable.length)];
  const ja = example.ja.trim();
  const start = ja.indexOf(surface);
  const span = { start, end: start + surface.length };
  const prompt = ja.replace(surface, BLANK);

  const distractors = pickDistractors(target, prompt, pool, rand);
  if (distractors.length < CLOZE_CHOICES - 1) return null;

  const toChoice = (item: ClozeItem): ClozeChoice => ({
    itemId: item.id,
    expression: item.expression,
    reading: item.reading,
  });
  const choices = shuffled([target, ...distractors], rand).map(toChoice);
  return {
    itemId: target.id,
    prompt,
    sentence: markSpan(ja, example.jaRuby?.trim(), span, 'blank'),
    translation: example.vi?.trim() || null,
    choices,
    answerIndex: choices.findIndex((c) => c.itemId === target.id),
  };
}
