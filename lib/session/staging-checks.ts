// Sanity checks run before stage_sentence writes anything. Self-hosted tutors (Hermes on Gemma) were
// seen to (1) stage a VOCAB item the sentence never uses — it then got a review it never earned — and
// (2) put okurigana inside a furigana reading (青[あおい]い instead of 青[あお]い). Both are repaired
// here and reported back to the model in plain words, instead of failing the whole turn.

const KANJI = /[一-鿿々]/;
const RUBY = /([一-鿿々]+)\[([ぁ-ゖー]+)\]([ぁ-ゖ]*)/g;
const INFLECTING_END = /[うくすつぬふむゆるぐぶぷい]$/;

// Forms worth looking for in the sentence: the word, its kanji stem (会う → 会, 確認する → 確認), and
// for kana the reading minus an inflecting ending (あう → あ is too short, so only from 3 chars up).
export function searchForms(expression: string, reading: string | null): string[] {
  const forms = new Set<string>([expression]);
  const chars = [...expression];
  const lastKanji = chars.map((c) => KANJI.test(c)).lastIndexOf(true);
  if (lastKanji >= 0) forms.add(chars.slice(0, lastKanji + 1).join(''));
  for (const kana of [reading, lastKanji < 0 ? expression : null]) {
    if (!kana) continue;
    forms.add(kana);
    if ([...kana].length >= 3 && INFLECTING_END.test(kana))
      forms.add([...kana].slice(0, -1).join(''));
  }
  return [...forms].filter((f) => f.length > 0);
}

export function vocabAppears(
  expression: string,
  reading: string | null,
  japanese: string,
): boolean {
  return searchForms(expression, reading).some((f) => japanese.includes(f));
}

export function stripRuby(ruby: string): string {
  return ruby.replace(/\[[^\]]*\]/g, '');
}

// 青[あおい]い → 青[あお]い, but ONLY when kanji + following kana is a word we know whose reading equals
// the bracket (so 間[あいだ]だ — "間" + copula — is left alone).
export function fixOkurigana(
  ruby: string,
  knownReadings: ReadonlyMap<string, string>,
): { ruby: string; fixed: string[] } {
  const fixed: string[] = [];
  const out = ruby.replace(RUBY, (whole, kanji: string, reading: string, after: string) => {
    for (let k = Math.min(after.length, reading.length - 1); k >= 1; k--) {
      const okuri = after.slice(0, k);
      if (!reading.endsWith(okuri)) continue;
      if (knownReadings.get(kanji + okuri) !== reading) continue;
      const good = reading.slice(0, -k);
      fixed.push(`${kanji}[${reading}]${okuri} → ${kanji}[${good}]${okuri}`);
      return `${kanji}[${good}]${after}`;
    }
    return whole;
  });
  return { ruby: out, fixed };
}

// Every kanji+okurigana prefix in the ruby text that could be a dictionary word — what to look up.
export function okuriganaCandidates(ruby: string): string[] {
  const out = new Set<string>();
  for (const m of ruby.matchAll(RUBY)) {
    const [, kanji, , after] = m;
    for (let k = 1; k <= Math.min(after.length, 3); k++) out.add(kanji + after.slice(0, k));
  }
  return [...out];
}
