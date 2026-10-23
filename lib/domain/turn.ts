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
// The a-row kana a verb takes before ない, and the i-row kana it takes before ません.
const BEFORE_MASEN: Record<string, string> = {
  あ: 'い',
  か: 'き',
  さ: 'し',
  た: 'ち',
  な: 'に',
  は: 'ひ',
  ま: 'み',
  ら: 'り',
  わ: 'い',
  が: 'ぎ',
  ざ: 'じ',
  だ: 'ぢ',
  ば: 'び',
  ぱ: 'ぴ',
};

// The written forms of a pattern's last part that count as using it once it is conjugated.
// Kanji with okurigana keep the kanji run (急ぐ → 急, 得ない → 得). A kana form ending in ない
// also counts in its polite forms (いけない → いけません, ならない → なりません, はずがない →
// はずがありません); one ending in する or くる in any form of the verb; one ending in い in its
// adjective forms (たい → たくない, たかった); other kana forms lose one conjugating ending
// (べきだ → べき). A single part that would shrink to one kana (な, た, ま) matches almost
// anything, so the whole form is kept; after an earlier part it is anchored enough.
export function conjugatedForms(form: string, allowShort = false): string[] {
  if (KANJI.test(form)) {
    const core = form.replace(HIRAGANA_TAIL, '');
    if (core) return [core];
  }
  const forms: string[] = [form];
  if (form === 'ない') {
    forms.push('なかっ', 'なく', 'ません');
  } else if (form.endsWith('ない')) {
    const stem = form.slice(0, -2);
    const last = stem.slice(-1);
    forms.push(stem, `${stem}あり`);
    if (BEFORE_MASEN[last]) forms.push(stem.slice(0, -1) + BEFORE_MASEN[last]);
  } else if (form.endsWith('する') || form.endsWith('くる')) {
    // する and くる change their first kana (にする → にします, てくる → てきます).
    const stem = form.slice(0, -2);
    const kana = form.endsWith('する') ? ['し', 'す', 'さ', 'せ'] : ['き', 'く', 'こ'];
    forms.push(stem, ...kana.map((k) => stem + k));
  } else if (form.endsWith('い')) {
    // i-adjective endings: たい → たくない, たかった.
    const stem = form.slice(0, -1);
    forms.push(stem, `${stem}く`, `${stem}かっ`);
  } else {
    forms.push(form.replace(CONJUGATING_TAIL, ''));
  }
  const usable = forms.filter((f) => [...f].length > (allowShort ? 0 : 1));
  return usable.length > 0 ? usable : [form];
}

// て and た become で and だ after some verbs (読んで, 急いだ): a part may start with either.
function withVoicing(forms: string[]): string[] {
  const voiced = forms
    .filter((f) => f.startsWith('て') || f.startsWith('た'))
    .map((f) => (f.startsWith('て') ? 'で' : 'だ') + f.slice(1));
  return [...forms, ...voiced];
}

// A grammar pattern as written in the library: "〜ても / 〜でも", "たとえ〜ても", "〜にする（decide）",
// "〜ことに（は）". Brackets hold notes or optional kana and are dropped. Any one alternative counts;
// within it every part must appear in order, the last part in any of its conjugated forms.
export function patternAppears(expression: string, ja: string): boolean {
  const text = ja.normalize('NFKC');
  const cleaned = expression
    .normalize('NFKC')
    .replace(/[(（][^)）]*[)）]/gu, '')
    .replace(/[「」『』]/gu, '');
  return cleaned.split(/\s*[/／]\s*/u).some((alternative) => {
    const parts = alternative
      .split(/[~〜～]/u)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return false;
    let from = 0;
    return parts.every((part, i) => {
      const last = i === parts.length - 1;
      const needles = withVoicing(last ? conjugatedForms(part, parts.length > 1) : [part]);
      const hits = needles
        .map((needle) => ({ at: text.indexOf(needle, from), length: needle.length }))
        .filter((hit) => hit.at >= 0);
      if (hits.length === 0) return false;
      from = Math.min(...hits.map((hit) => hit.at + hit.length));
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
  // The exact words in ja that use the target, for an irregular form the checks below miss.
  uses: string | null;
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
  const uses = draft.uses?.trim() ?? '';
  if (uses && ([...uses].length < 2 || !ja.includes(uses))) {
    return err('uses must be two or more characters copied exactly from ja.');
  }
  const appears =
    !!uses ||
    (target.kind === 'VOCAB'
      ? vocabAppears(target.expression, target.reading, ja)
      : patternAppears(target.expression, ja));
  if (!appears) {
    return err(
      `ja does not use ${target.expression}. Rewrite it around ${target.expression}, or pass uses: the exact words in ja that use it.`,
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
