import { err, ok, type ActionResult } from '@/lib/core/action-result';
import { parseFurigana } from '@/lib/japanese/furigana';
import type { ItemKind } from '@/lib/library/item-kinds';
import { vocabAppears } from '@/lib/session/staging-checks';
import type { RatingValue } from '@/lib/srs/srs';

// One translation turn with Claude: exactly one target item, staged once, then either graded once or
// skipped. Every error names the one call that fixes it, because the reader is a model.

export type TurnStatus = 'staged' | 'graded' | 'skipped';

export type TurnEvent = { type: 'grade'; rating: RatingValue } | { type: 'skip' };

export function nextTurnStatus(status: TurnStatus, event: TurnEvent): ActionResult<TurnStatus> {
  if (status === 'graded') return err('Turn already graded. Call next_turn for a new one.');
  if (status === 'skipped') return err('Turn was skipped. Call next_turn for a new one.');
  return ok(event.type === 'grade' ? 'graded' : 'skipped');
}

const RATINGS: readonly number[] = [1, 2, 3, 4];

export function parseRating(value: unknown): ActionResult<RatingValue> {
  if (typeof value === 'number' && RATINGS.includes(value)) return ok(value as RatingValue);
  return err('rating must be 1, 2, 3 or 4 (1 = wrong, 4 = easy).');
}

// Grading rules the server enforces instead of asking the model to remember them.
export function finalRating(rating: RatingValue, hinted: boolean): RatingValue {
  return hinted && rating === 4 ? 3 : rating;
}

// ---- Staging checks: the sentence Claude wrote, before it is shown to the learner ----

// The spec's length window is what Claude is asked for; models count characters loosely, so the
// server only refuses a sentence well outside it. A spoken hint ("longer sentences") lifts the
// window, but never the hard ceiling.
const LENGTH_SLACK = 0.25;
export const MAX_SENTENCE_CHARS = 80;

export function sentenceLength(ja: string): number {
  return [...ja.replace(/[\s。、，．！？!?,.「」『』（）()…・]/gu, '')].length;
}

export function allowedLength(
  lengthJa: readonly [number, number],
  hint: string | null,
): readonly [number, number] {
  if (hint) return [1, MAX_SENTENCE_CHARS];
  const [min, max] = lengthJa;
  return [
    Math.max(1, Math.floor(min * (1 - LENGTH_SLACK))),
    Math.min(MAX_SENTENCE_CHARS, Math.ceil(max * (1 + LENGTH_SLACK))),
  ];
}

const KANJI = /[一-鿿々]/u;
const HIRAGANA_TAIL = /[ぁ-ゖ]+$/u;
// Endings that change when a word conjugates: する, the copula, polite endings, i-adjectives, verbs.
const CONJUGATING_TAIL = /(する|です|ます|だ|い|[うくすつぬむぶぐる])$/u;

// The part of a written form that survives conjugation: kanji with okurigana keep the kanji run
// (急ぐ → 急, 得ない → 得), kana lose one conjugating ending (ことにする → ことに, はずがない → はずがな).
export function stableCore(form: string): string {
  if (KANJI.test(form)) {
    const core = form.replace(HIRAGANA_TAIL, '');
    if (core) return core;
  }
  const core = form.replace(CONJUGATING_TAIL, '');
  return core.length > 0 ? core : form;
}

// A grammar pattern as written in the library: "〜ても / 〜でも", "たとえ〜ても", "〜にする（decide）".
// Any one alternative counts; within it every part must appear in order, the last part by its core.
export function patternAppears(expression: string, ja: string): boolean {
  const text = ja.normalize('NFKC');
  const cleaned = expression
    .normalize('NFKC')
    .replace(/[(（][^)）]*[A-Za-z][^)）]*[)）]/gu, '')
    .replace(/[「」『』()（）]/gu, '');
  return cleaned.split(/\s*[/／]\s*/u).some((alternative) => {
    const parts = alternative
      .split(/[~〜～]/u)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return false;
    let from = 0;
    return parts.every((part, i) => {
      const needle = i === parts.length - 1 ? stableCore(part) : part;
      const at = text.indexOf(needle, from);
      if (at < 0) return false;
      from = at + needle.length;
      return true;
    });
  });
}

export interface StageDraft {
  ja: string;
  // 漢字[かな] markup of the same sentence, optional.
  jaRuby: string | null;
  vi: string;
  hint: string | null;
}

export interface StageTarget {
  kind: ItemKind;
  expression: string;
  reading: string | null;
}

export function checkStage(
  draft: StageDraft,
  target: StageTarget,
  lengthJa: readonly [number, number],
): ActionResult<undefined> {
  const ja = draft.ja.trim();
  if (!ja) return err('ja is empty. Write the Japanese sentence, then call stage_turn again.');
  if (!draft.vi.trim()) {
    return err('vi is empty. Write the Vietnamese sentence, then call stage_turn again.');
  }
  const [min, max] = allowedLength(lengthJa, draft.hint);
  const length = sentenceLength(ja);
  if (length < min || length > max) {
    return err(
      `ja is ${length} characters; write ${lengthJa[0]}-${lengthJa[1]}, then call stage_turn again.`,
    );
  }
  const appears =
    target.kind === 'VOCAB'
      ? vocabAppears(target.expression, target.reading, ja)
      : patternAppears(target.expression, ja);
  if (!appears) {
    return err(
      `ja does not use ${target.expression}. Rewrite it around ${target.expression}, then call stage_turn again.`,
    );
  }
  if (draft.jaRuby?.trim()) {
    const spelled = parseFurigana(draft.jaRuby.trim())
      .map((s) => s.text)
      .join('');
    if (spelled !== ja) return err('jaRuby must spell ja exactly. Fix it or leave jaRuby out.');
  }
  return ok(undefined);
}
