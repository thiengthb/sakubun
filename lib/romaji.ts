// Kana → Hepburn romaji, used ONLY to make search forgiving: a learner types "takai" / "nagara" and we
// match 高い / 〜ながら by romanizing the item's kana reading + expression into a hidden search string.
// Not a full transliterator (no morphology, no rendaku guessing) — it converts kana it recognizes and
// passes anything else through unchanged, which is all the global filter needs.

// Two-kana digraphs first (youon), then single kana. Katakana is normalized to hiragana up front.
const DIGRAPHS: Record<string, string> = {
  きゃ: 'kya',
  きゅ: 'kyu',
  きょ: 'kyo',
  しゃ: 'sha',
  しゅ: 'shu',
  しょ: 'sho',
  ちゃ: 'cha',
  ちゅ: 'chu',
  ちょ: 'cho',
  にゃ: 'nya',
  にゅ: 'nyu',
  にょ: 'nyo',
  ひゃ: 'hya',
  ひゅ: 'hyu',
  ひょ: 'hyo',
  みゃ: 'mya',
  みゅ: 'myu',
  みょ: 'myo',
  りゃ: 'rya',
  りゅ: 'ryu',
  りょ: 'ryo',
  ぎゃ: 'gya',
  ぎゅ: 'gyu',
  ぎょ: 'gyo',
  じゃ: 'ja',
  じゅ: 'ju',
  じょ: 'jo',
  ぢゃ: 'ja',
  ぢゅ: 'ju',
  ぢょ: 'jo',
  びゃ: 'bya',
  びゅ: 'byu',
  びょ: 'byo',
  ぴゃ: 'pya',
  ぴゅ: 'pyu',
  ぴょ: 'pyo',
};

const MONO: Record<string, string> = {
  あ: 'a',
  い: 'i',
  う: 'u',
  え: 'e',
  お: 'o',
  か: 'ka',
  き: 'ki',
  く: 'ku',
  け: 'ke',
  こ: 'ko',
  が: 'ga',
  ぎ: 'gi',
  ぐ: 'gu',
  げ: 'ge',
  ご: 'go',
  さ: 'sa',
  し: 'shi',
  す: 'su',
  せ: 'se',
  そ: 'so',
  ざ: 'za',
  じ: 'ji',
  ず: 'zu',
  ぜ: 'ze',
  ぞ: 'zo',
  た: 'ta',
  ち: 'chi',
  つ: 'tsu',
  て: 'te',
  と: 'to',
  だ: 'da',
  ぢ: 'ji',
  づ: 'zu',
  で: 'de',
  ど: 'do',
  な: 'na',
  に: 'ni',
  ぬ: 'nu',
  ね: 'ne',
  の: 'no',
  は: 'ha',
  ひ: 'hi',
  ふ: 'fu',
  へ: 'he',
  ほ: 'ho',
  ば: 'ba',
  び: 'bi',
  ぶ: 'bu',
  べ: 'be',
  ぼ: 'bo',
  ぱ: 'pa',
  ぴ: 'pi',
  ぷ: 'pu',
  ぺ: 'pe',
  ぽ: 'po',
  ま: 'ma',
  み: 'mi',
  む: 'mu',
  め: 'me',
  も: 'mo',
  や: 'ya',
  ゆ: 'yu',
  よ: 'yo',
  ら: 'ra',
  り: 'ri',
  る: 'ru',
  れ: 're',
  ろ: 'ro',
  わ: 'wa',
  ゐ: 'i',
  ゑ: 'e',
  を: 'o',
  ん: 'n',
  ゔ: 'vu',
  ぁ: 'a',
  ぃ: 'i',
  ぅ: 'u',
  ぇ: 'e',
  ぉ: 'o',
  ゃ: 'ya',
  ゅ: 'yu',
  ょ: 'yo',
};

/** Normalize katakana (U+30A1–30F6) to hiragana so one table covers both. */
function kataToHira(input: string): string {
  return input.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

const VOWELS = new Set(['a', 'i', 'u', 'e', 'o']);

/**
 * Romanize a (mostly-kana) string to lowercase Hepburn. Small っ geminates the next consonant, ー / っ
 * edge cases degrade gracefully, and any non-kana char passes through unchanged.
 */
export function toRomaji(input: string): string {
  if (!input) return '';
  const s = kataToHira(input);
  let out = '';
  let geminate = false; // pending small-tsu → double the next syllable's leading consonant
  for (let i = 0; i < s.length; i++) {
    const pair = s.slice(i, i + 2);
    let roma: string | undefined = DIGRAPHS[pair];
    if (roma) i++;
    else if (s[i] === 'っ') {
      geminate = true;
      continue;
    } else if (s[i] === 'ー') {
      // Long-vowel mark → repeat the previous vowel letter (drop if there's nothing to repeat).
      const last = out.at(-1);
      if (last && VOWELS.has(last)) out += last;
      continue;
    } else {
      roma = MONO[s[i]];
    }
    if (roma === undefined) {
      out += s[i]; // unknown (kanji/punct/space) — leave it, still useful for substring search
      geminate = false;
      continue;
    }
    if (geminate) {
      // Hepburn: っ before ch → "tch"; otherwise double the leading consonant.
      out += roma.startsWith('ch') ? 't' : roma[0];
      geminate = false;
    }
    out += roma;
  }
  return out;
}
