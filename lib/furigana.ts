// Parse Claude's per-kanji ruby markup into segments the UI renders as <ruby>. Claude annotates the
// JA exercise sentence as `漢字[かな]` (base kanji immediately followed by its reading in brackets),
// e.g. 彼[かれ]は忙[いそが]しい. We deliberately do NOT tokenize Japanese ourselves (sakubun ships no
// morphological analyzer by design) — the reading segmentation comes from Claude, which knows it.

const KANJI = /[㐀-䶿一-鿿々〆〇ヶ]+$/;

export interface FuriganaSegment {
  /** The literal text of this segment (kanji base when `reading` is present, else plain kana/punct). */
  text: string;
  /** Reading shown above `text` as furigana; absent for plain (non-annotated) runs. */
  reading?: string;
}

/**
 * Split `漢字[かな]`-annotated text into ordered segments. The base of each `[reading]` is the maximal
 * trailing run of kanji before the bracket, so `は忙[いそが]` yields plain "は" + ruby(忙, いそが). A
 * bracket with no kanji base before it is kept literally (malformed input degrades, never throws).
 */
export function parseFurigana(markup: string): FuriganaSegment[] {
  const segments: FuriganaSegment[] = [];
  // Allow EMPTY brackets too (`[]`): Claude sometimes appends `word[]` to non-kanji words, and those
  // empty markers must be swallowed, not shown literally (the `この[]ネックレス[]…` leak). `[^\]]*` (star)
  // matches the empty case; a whitespace-only reading is treated the same as empty.
  const re = /\[([^\]]*)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (text: string, reading?: string) => {
    if (!text) return;
    segments.push(reading ? { text, reading } : { text });
  };
  while ((m = re.exec(markup)) !== null) {
    const reading = m[1].trim();
    const before = markup.slice(last, m.index);
    const baseMatch = before.match(KANJI);
    const base = baseMatch ? baseMatch[0] : '';
    const literal = base ? before.slice(0, before.length - base.length) : before;
    push(literal);
    if (base && reading)
      push(base, reading); // real furigana: kanji base + a reading
    else if (base)
      push(base); // empty `[]` right after kanji → keep the kanji, drop the brackets
    else if (reading) push(`[${reading}]`); // no kanji base but has content → show as-is (not furigana)
    // else: no base AND empty reading → a bare `[]` on kana/katakana → drop entirely
    last = re.lastIndex;
  }
  push(markup.slice(last));
  return segments;
}

/** True when the markup actually contains at least one usable `漢字[かな]` annotation. */
export function hasFurigana(markup: string | null | undefined): boolean {
  return !!markup && parseFurigana(markup).some((s) => s.reading);
}

const KANJI_CHAR = /[㐀-䶿一-鿿々〆〇ヶ]/;
const KANA_CHAR = /[ぁ-んァ-ヶーゝゞ]/;

/** Katakana → hiragana, for matching a katakana surface against a hiragana reading. */
function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/**
 * Build `漢字[かな]` furigana markup by ALIGNING a full kana `reading` onto the kanji of `expression`,
 * so a stored term renders furigana over just its kanji — not the whole word. This fixes the okurigana
 * case: 食べる + たべる → `食[た]べる` (the old `expression[reading]` produced `食べる[たべる]`, which
 * parseFurigana can't read because the bracket doesn't sit right after a kanji, so it showed NO ruby).
 *
 * Algorithm: split the surface into runs of kanji / kana / other (〜, punctuation — kept literal, never
 * consumes reading). Kana runs must match the reading (okurigana); each kanji run takes the reading up
 * to where the following kana run reappears (or the end). Returns null when there is no kanji to
 * annotate, or when the reading can't be aligned AND the surface isn't a single clean kanji run — a
 * wrong ruby is worse than none. A contiguous all-kanji surface always wraps whole (図書館[としょかん],
 * incl. jukujikun like 今日[きょう]).
 */
export function buildFuriganaMarkup(
  expression: string,
  reading: string | null | undefined,
): string | null {
  if (!reading) return null;
  // A reading must never carry the 〜/～ placeholder a grammar pattern uses in its surface (Claude
  // echoes it: 〜って感じ → 〜ってかんじ). The surface 〜 is already a literal "other" run that consumes
  // no reading, so a 〜 left in the reading only breaks the alignment — strip it before aligning.
  reading = reading.replace(/[〜～]/g, '');
  if (!reading) return null;
  type Kind = 'kanji' | 'kana' | 'other';
  const kindOf = (c: string): Kind =>
    KANJI_CHAR.test(c) ? 'kanji' : KANA_CHAR.test(c) ? 'kana' : 'other';

  const runs: { text: string; kind: Kind }[] = [];
  for (const ch of expression) {
    const kind = kindOf(ch);
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.text += ch;
    else runs.push({ text: ch, kind });
  }
  if (!runs.some((r) => r.kind === 'kanji')) return null; // nothing to annotate

  const rd = toHiragana(reading);
  let r = 0;
  let out = '';
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    if (run.kind === 'other') {
      out += run.text; // 〜, punctuation — literal, consumes no reading
      continue;
    }
    if (run.kind === 'kana') {
      const kana = toHiragana(run.text);
      if (toHiragana(rd.slice(r, r + kana.length)) !== kana)
        return fallback(runs, expression, reading);
      out += run.text;
      r += kana.length;
      continue;
    }
    // kanji run: its reading spans until the next kana run reappears in `rd` (or the end).
    let nextKana = '';
    for (let j = i + 1; j < runs.length; j++) {
      if (runs[j].kind === 'kana') {
        nextKana = toHiragana(runs[j].text);
        break;
      }
      if (runs[j].kind === 'kanji') break; // adjacent kanji run (via `other`) — no kana boundary
    }
    const end = nextKana ? rd.indexOf(nextKana, r + 1) : rd.length;
    if (end === -1 || end <= r) return fallback(runs, expression, reading);
    out += `${run.text}[${reading.slice(r, end)}]`;
    r += end - r;
  }
  // Every reading char must be consumed, else the alignment was wrong.
  return r === rd.length ? out : fallback(runs, expression, reading);
}

/** When per-kanji alignment fails, still show furigana IF the surface is one clean kanji run. */
function fallback(
  runs: { text: string; kind: string }[],
  expression: string,
  reading: string,
): string | null {
  return runs.length === 1 && runs[0].kind === 'kanji' ? `${expression}[${reading}]` : null;
}
