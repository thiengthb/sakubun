import { err, ok, type ActionResult } from '@/lib/core/action-result';
import { MAX_SENTENCE_CHARS, patternAppears, sentenceLength } from '@/lib/domain/turn';
import { parseFurigana } from '@/lib/japanese/furigana';
import {
  CURRENT_ENRICHMENT_VERSION,
  ENRICHMENT_CAPS,
  enrichmentSchema,
} from '@/lib/library/enrichment';
import { vocabAppears } from '@/lib/session/staging-checks';

// One example sentence added to an item's card by the learner's AI (MCP example_add,
// docs/plans/2026-10-28-quick-review.md, C5). An item with no card gets one that holds only the
// sentence: its usage stays empty, so the card counts as thin until a full one is written (thien's
// choice, 2026-10-28). Pure: the caller reads and writes the item.

export interface NewExample {
  ja: string;
  vi: string;
  // 漢字[かな] markup of the same sentence, optional.
  jaRuby?: string | null;
}

export interface ExampleTarget {
  kind: string;
  expression: string;
  reading: string | null;
}

const JAPANESE = /[぀-ヿ㐀-鿿]/u;

export function withExample(
  raw: string | null,
  target: ExampleTarget,
  input: NewExample,
): ActionResult<{ enrichment: string; created: boolean; sentences: number }> {
  const ja = input.ja.trim();
  const vi = input.vi.trim();
  const jaRuby = input.jaRuby?.trim() || undefined;
  if (!ja) return err('ja is empty. Write the Japanese sentence, then call example_add again.');
  if (sentenceLength(ja) > MAX_SENTENCE_CHARS) {
    return err(`ja is too long; keep it at most ${MAX_SENTENCE_CHARS} characters.`);
  }
  if (!vi || JAPANESE.test(vi)) {
    return err('vi must be the Vietnamese translation, with no Japanese in it.');
  }
  const appears =
    target.kind === 'VOCAB'
      ? vocabAppears(target.expression, target.reading, ja)
      : patternAppears(target.expression, ja);
  if (!appears) return err(`ja does not use ${target.expression}. Rewrite it around it.`);
  if (
    jaRuby &&
    parseFurigana(jaRuby)
      .map((s) => s.text)
      .join('') !== ja
  ) {
    return err('jaRuby must spell ja exactly. Fix it or leave jaRuby out.');
  }
  const example = { ja, vi, ...(jaRuby ? { jaRuby } : {}) };

  if (!raw) {
    const card = enrichmentSchema.parse({ usage: '', example, v: CURRENT_ENRICHMENT_VERSION });
    return ok({ enrichment: JSON.stringify(card), created: true, sentences: 1 });
  }
  // Added to the stored JSON as it is, so fields this version does not know are kept.
  let stored: Record<string, unknown>;
  try {
    stored = JSON.parse(raw);
  } catch {
    stored = {};
  }
  const card = enrichmentSchema.safeParse(stored);
  if (!card.success) {
    return err("The item's card is broken; it takes no sentence until it is rewritten.");
  }
  const sentences = [card.data.example, ...card.data.examples];
  if (sentences.some((s) => s.ja.trim() === ja)) {
    return err('The card already has this sentence.');
  }
  if (card.data.examples.length >= ENRICHMENT_CAPS.examples) {
    return err(`The card is full (${sentences.length} sentences).`);
  }
  const next = { ...stored, examples: [...card.data.examples, example] };
  return ok({ enrichment: JSON.stringify(next), created: false, sentences: sentences.length + 1 });
}
