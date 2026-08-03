import { describe, expect, it } from 'vitest';
import { parseEnrichment, toTutorCard } from '@/lib/enrichment';

// A card exactly as it was written BEFORE jaRuby existed (2026-07-20). The whole optional-field
// decision rests on this staying parseable — if it ever fails, every enriched item in the library
// silently loses its usage card.
const LEGACY_CARD = JSON.stringify({
  structure: ['動詞辞書形 + ばかりに'],
  usage: 'chỉ vì … mà (dẫn tới kết quả xấu)',
  collocations: [],
  example: { ja: '一言言ったばかりに、彼は怒った。', vi: 'Chỉ vì nói một câu mà anh ấy giận.' },
  examples: [{ ja: '寝坊したばかりに、遅刻した。', vi: 'Chỉ vì ngủ quên mà tôi đến muộn.' }],
  pitfalls: [],
  contrasts: [],
});

describe('parseEnrichment', () => {
  it('still parses a card written before jaRuby existed', () => {
    const parsed = parseEnrichment(LEGACY_CARD);
    expect(parsed).not.toBeNull();
    expect(parsed?.example.ja).toBe('一言言ったばかりに、彼は怒った。');
    expect(parsed?.example.jaRuby).toBeUndefined();
    expect(parsed?.examples).toHaveLength(1);
    expect(parsed?.examples[0].jaRuby).toBeUndefined();
  });

  it('exposes jaRuby when the card carries it', () => {
    const card = JSON.parse(LEGACY_CARD) as Record<string, unknown>;
    card.example = {
      ja: '一言言ったばかりに、彼は怒った。',
      vi: 'Chỉ vì nói một câu mà anh ấy giận.',
      jaRuby: '一言[ひとこと]言[い]ったばかりに、彼[かれ]は怒[おこ]った。',
    };
    const parsed = parseEnrichment(JSON.stringify(card));
    expect(parsed?.example.jaRuby).toContain('[ひとこと]');
  });

  it('returns null for absent or malformed input rather than throwing', () => {
    expect(parseEnrichment(null)).toBeNull();
    expect(parseEnrichment('')).toBeNull();
    expect(parseEnrichment('not json')).toBeNull();
    expect(parseEnrichment('{"usage":"missing everything else"}')).toBeNull();
  });
});

describe('toTutorCard', () => {
  const raw = JSON.stringify({
    structure: ['動詞辞書形 + ばかりに'],
    usage: 'chỉ vì',
    collocations: ['言ったばかりに'],
    example: {
      ja: '一言言ったばかりに。',
      vi: 'Chỉ vì lỡ nói một câu.',
      jaRuby: '一言[ひとこと]言[い]ったばかりに。',
    },
    examples: [
      { ja: 'A。', vi: 'a', jaRuby: 'A[あ]。' },
      { ja: 'B。', vi: 'b', jaRuby: 'B[び]。' },
      { ja: 'C。', vi: 'c', jaRuby: 'C[し]。' },
    ],
    pitfalls: ['chỉ dùng cho kết quả xấu'],
    contrasts: [{ with: 'おかげで', note: 'kết quả tốt' }],
    register: 'văn viết',
  });

  it('keeps every field the tutor protocol names', () => {
    const card = toTutorCard(raw, false)!;
    expect(card.usage).toBe('chỉ vì');
    expect(card.structure).toEqual(['動詞辞書形 + ばかりに']);
    expect(card.collocations).toEqual(['言ったばかりに']);
    expect(card.pitfalls).toEqual(['chỉ dùng cho kết quả xấu']);
    expect(card.contrasts).toEqual([{ with: 'おかげで', note: 'kết quả tốt' }]);
    expect(card.register).toBe('văn viết');
  });

  it('omits examples entirely for a review item', () => {
    // Most of a batch is review items, so this is where the saving actually comes from.
    expect(toTutorCard(raw, false)!.examples).toBeUndefined();
  });

  it('includes capped, ruby-free examples when introducing a new pattern', () => {
    const card = toTutorCard(raw, true)!;
    expect(card.examples).toHaveLength(2);
    // The canonical `example` leads, then the extras.
    expect(card.examples![0]).toEqual({ ja: '一言言ったばかりに。', vi: 'Chỉ vì lỡ nói một câu.' });
    // jaRuby is the app's furigana markup; Claude writes its own sourceRuby and never reads this.
    expect(card.examples!.every((e) => !('jaRuby' in e))).toBe(true);
  });

  it('returns null for an unenriched item', () => {
    expect(toTutorCard(null, true)).toBeNull();
    expect(toTutorCard('not json', false)).toBeNull();
  });
});
