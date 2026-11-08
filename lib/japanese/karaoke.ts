import type { FuriganaSegment } from '@/lib/japanese/furigana';

// Karaoke by the syllable (Kaiwa b, thien 2026-11-07): a line lights up as each mora is read, not at
// an even pace. VOICEVOX's audio_query says how long every mora lasts; the line's furigana says
// which characters each mora belongs to. When the two do not agree (a reading VOICEVOX chose
// differently, digits, a kanji without furigana), the caller keeps the even pace. Pure.

interface QueryMora {
  consonant_length?: number | null;
  vowel_length: number;
}

// The fields of a VOICEVOX audio_query the timeline reads.
export interface AudioQuery {
  accent_phrases?: { moras: QueryMora[]; pause_mora?: QueryMora | null }[];
  prePhonemeLength?: number;
  postPhonemeLength?: number;
  pauseLength?: number | null;
  pauseLengthScale?: number;
}

const moraLength = (m: QueryMora) => (m.consonant_length ?? 0) + m.vowel_length;

// When each mora starts, as a share of the whole reading (0 to 1). VOICEVOX's speed divides every
// length alike, silences included, so the shares are the same at any speed: one timeline serves
// the normal and the slow play.
export function moraStarts(query: AudioQuery): number[] | null {
  let t = query.prePhonemeLength ?? 0;
  const starts: number[] = [];
  for (const phrase of query.accent_phrases ?? []) {
    for (const mora of phrase.moras) {
      starts.push(t);
      t += moraLength(mora);
    }
    if (phrase.pause_mora)
      t += query.pauseLength ?? moraLength(phrase.pause_mora) * (query.pauseLengthScale ?? 1);
  }
  const total = t + (query.postPhonemeLength ?? 0);
  if (starts.length === 0 || !(total > 0)) return null;
  return starts.map((s) => s / total);
}

const SMALL_KANA = /[ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ]/;
const KANA = /[ぁ-ゖァ-ヺー]/;
// Read aloud only through a reading we do not have: kanji, digits, Latin letters.
const NEEDS_READING = /[\p{Script=Han}\p{N}\p{L}]/u;

// How many morae a kana reading has: a small kana joins the one before it (きょ is one), っ ん ー count.
export function moraCount(kana: string): number {
  return [...kana].filter((c) => KANA.test(c) && !SMALL_KANA.test(c)).length;
}

// How many morae each character of the line carries, from its furigana segments; null when some
// character's sound is unknown. A kanji run shares its reading's morae out, the first ones longest.
export function charMorae(segments: readonly FuriganaSegment[]): number[] | null {
  const out: number[] = [];
  for (const seg of segments) {
    const chars = [...seg.text];
    if (seg.reading) {
      const n = moraCount(seg.reading);
      if (n < chars.length) return null;
      chars.forEach((_, i) =>
        out.push(Math.floor(n / chars.length) + (i < n % chars.length ? 1 : 0)),
      );
      continue;
    }
    for (const c of chars) {
      if (KANA.test(c)) out.push(SMALL_KANA.test(c) ? 0 : 1);
      else if (NEEDS_READING.test(c)) return null;
      else out.push(0); // punctuation and spaces are silent
    }
  }
  return out;
}

// How many characters are lit `ratio` of the way through the reading, or null when the line and
// the reading do not have the same number of morae. A character lights as its first mora starts;
// a silent one (small kana, punctuation) lights with the character before it.
export function karaokeLit(
  starts: readonly number[],
  segments: readonly FuriganaSegment[],
): ((ratio: number) => number) | null {
  const morae = charMorae(segments);
  if (!morae || morae.reduce((a, b) => a + b, 0) !== starts.length) return null;
  return (ratio) => {
    if (ratio <= 0) return 0;
    let spoken = 0;
    while (spoken < starts.length && starts[spoken] <= ratio) spoken++;
    let before = 0;
    let lit = 0;
    for (const m of morae) {
      if (m > 0 ? spoken <= before : spoken < before) break;
      before += m;
      lit++;
    }
    return lit;
  };
}
