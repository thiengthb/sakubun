// Normalize free text that may arrive carrying HTML entities / non-breaking spaces from a scraped
// source (the MAZII grammar import wraps patterns in `&nbsp;` padding, which then rendered literally
// in the history tag). Decodes the common named entities + numeric refs, folds every whitespace kind
// (incl. U+00A0) to a single ASCII space, and trims. Pure + idempotent — safe to run on every write.

// Named entities worth decoding; bare `&` / numeric refs are handled separately below. A literal
// ampersand ("A & B") is left untouched because it lacks the trailing `;` an entity requires.
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

export function cleanText(input: string): string {
  const decoded = input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#')) {
      const code = /^#x/i.test(body)
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
  // Also strip emoji here so item content Claude sends (grammar/meaning/notes) never stores pictographs.
  return stripEmoji(decoded);
}

/** Clean an optional string, collapsing empty/whitespace-only results to null (DB nullable columns). */
export function cleanTextOrNull(input: string | null | undefined): string | null {
  if (input == null) return null;
  return cleanText(input) || null;
}

// Emoji / pictograph ranges (misc symbols+pictographs, dingbats, transport, flags, variation selector,
// ZWJ). Deliberately EXCLUDES arrows (U+2190–21FF) so "A → B" in a meaning survives. Covers the pictographic ranges.
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}]/gu;

/**
 * Strip emoji/pictographs from text that should be plain (grammar patterns, meanings, Claude-written
 * sentences/feedback) — Claude sometimes decorates output with pictographs that read as UI-icon noise in the
 * app. Applied at the WRITE boundary (item content) AND at display of Claude free text.
 */
export function stripEmoji(input: string): string {
  return input.replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim();
}

// Brackets/quotes a term may arrive wrapped in. Claude quotes words as 「…」 when it shows them to the
// learner, and that decoration leaks into the tool call.
const TERM_WRAPPERS: [string, string][] = [
  ['「', '」'],
  ['『', '』'],
  ['【', '】'],
  ['〈', '〉'],
  ['《', '》'],
  ['"', '"'],
  ['“', '”'],
  ["'", "'"],
  ['‘', '’'],
];

// A trailing parenthetical, ASCII or full-width: "言葉 (chưa hiểu)", "お茶（おちゃ）".
const TRAILING_PARENTHETICAL = /[(（][^()（）]*[)）]\s*$/;

/**
 * Normalize a VOCABULARY term to the bare surface form before it is stored.
 *
 * Why this exists: `lib/mcp/prompts.ts` tells Claude to ASK the learner using a decorated string —
 * `「A」(dùng sai) 「B」(chưa hiểu)` — and nothing structurally separated that DISPLAY format from the
 * DATA format, so the decoration rode into `add_vocab`'s `term` and was stored verbatim (2026-07-20).
 * It then showed in the vocab table, in the detail modal, and got READ ALOUD by TTS.
 *
 * The prompt and the tool description were both tightened, but neither is enforceable — the model may
 * ignore either. This is the boundary that actually holds. GRAMMAR patterns are deliberately NOT run
 * through it: a pattern legitimately carries 〜 and parentheses (e.g. `〜ばかりに（に）`).
 *
 * Returns '' when nothing survives, so the caller can reject rather than store a blank.
 */
export function cleanVocabTerm(input: string): string {
  let term = input.trim();
  // Loop: a term can be BOTH wrapped and suffixed — 「言葉」(chưa hiểu). Each pass removes at most one
  // layer, so repeat until a pass changes nothing (bounded: every pass strictly shortens the string).
  for (let before = ''; before !== term;) {
    before = term;
    for (const [open, close] of TERM_WRAPPERS) {
      // `>=` (not `>`) so an empty wrapper 「」 collapses to '' and the caller rejects it, rather than
      // being stored as literal brackets. A lone quote character is still too short to match.
      if (
        term.length >= open.length + close.length &&
        term.startsWith(open) &&
        term.endsWith(close)
      ) {
        term = term.slice(open.length, -close.length).trim();
        break;
      }
    }
    term = term.replace(TRAILING_PARENTHETICAL, '').trim();
  }
  return term;
}

/** A JA string with NO kanji (CJK ideograph) — its kana reading is redundant (used to drop grammar readings). */
export function hasKanji(input: string): boolean {
  return /[㐀-鿿豈-﫿]/.test(input);
}
