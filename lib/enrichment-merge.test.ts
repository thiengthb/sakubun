import { describe, expect, it } from 'vitest';
import { CURRENT_ENRICHMENT_VERSION, ENRICHMENT_CAPS, type Enrichment } from '@/lib/enrichment';
import { mergeEnrichment, patchFromDonor, type EnrichmentPatch } from '@/lib/enrichment-merge';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/item-kinds';

const mergeGrammar = (base: Enrichment, patch: EnrichmentPatch) =>
  mergeEnrichment(base, patch, GRAMMAR_KIND);

function card(over: Partial<Enrichment> = {}): Enrichment {
  return {
    structure: ['動詞辞書形 + 〜ばかりに'],
    usage: 'Diễn tả một nguyên nhân nhỏ dẫn tới hậu quả xấu ngoài mong đợi.',
    collocations: ['一言言ったばかりに'],
    example: {
      ja: '一言言ったばかりに彼を怒らせた。',
      vi: 'Chỉ vì nói một câu mà làm anh ấy tức.',
    },
    examples: [{ ja: '寝坊したばかりに試験を落ちた。', vi: 'Chỉ vì ngủ quên mà trượt kỳ thi.' }],
    pitfalls: ['Không dùng cho kết quả tốt.'],
    contrasts: [{ with: '〜せいで', note: '〜ばかりに nhấn vào hối tiếc mạnh hơn.' }],
    synonyms: [],
    antonyms: [],
    v: 1,
    ...over,
  };
}

describe('mergeEnrichment — existing content is never lost (the whole reason it exists)', () => {
  it('appending one contrast keeps every other field intact', () => {
    const base = card();
    const { card: out } = mergeGrammar(base, {
      add: { contrasts: [{ with: '〜おかげで', note: 'Ngược nghĩa: kết quả tốt.' }] },
    });

    expect(out.contrasts).toHaveLength(2);
    expect(out.contrasts[0]).toEqual(base.contrasts[0]);
    expect(out.structure).toEqual(base.structure);
    expect(out.collocations).toEqual(base.collocations);
    expect(out.pitfalls).toEqual(base.pitfalls);
    expect(out.usage).toBe(base.usage);
    expect(out.example).toEqual(base.example);
    expect(out.examples).toEqual(base.examples);
  });

  it('reports a no-op instead of pretending to have written something', () => {
    const report = mergeGrammar(card({ v: CURRENT_ENRICHMENT_VERSION }), { add: {} });
    expect(report.touched).toBe(false);
    expect(report.added).toEqual({});
    expect(report.replaced).toEqual([]);
  });
});

describe('mergeEnrichment — dedup uses the SAME key as "do I already have this?"', () => {
  it('a differently-decorated contrast target is a duplicate, not a second entry', () => {
    const report = mergeGrammar(card(), {
      add: {
        contrasts: [{ with: '「〜せいで」', note: 'Một cách diễn đạt khác của cùng ghi chú.' }],
      },
    });
    expect(report.card.contrasts).toHaveLength(1);
    expect(report.card.contrasts[0]?.note).toBe(card().contrasts[0]?.note); // the stored note WINS
    expect(report.skipped).toEqual([
      { field: 'contrasts', value: '「〜せいで」', reason: 'duplicate' },
    ]);
  });

  it('dedups within the incoming batch too', () => {
    const report = mergeGrammar(card(), {
      add: { pitfalls: ['Chỉ dùng cho hậu quả xấu.', 'chỉ  dùng cho hậu quả xấu'] },
    });
    expect(report.added.pitfalls).toBe(1);
    expect(report.skipped.map((s) => s.reason)).toEqual(['duplicate']);
  });

  it('an all-decoration entry is refused rather than stored as noise', () => {
    const report = mergeGrammar(card(), { add: { collocations: ['〜〜', '   '] } });
    expect(report.added.collocations).toBeUndefined();
    expect(report.skipped.every((s) => s.reason === 'empty')).toBe(true);
  });
});

describe('mergeEnrichment — the schema cap can only ever drop something NEW', () => {
  it('overflow is skipped with a reason, existing entries survive', () => {
    const full = Array.from({ length: ENRICHMENT_CAPS.pitfalls }, (_, i) => `bẫy số ${i}`);
    const report = mergeGrammar(card({ pitfalls: full }), {
      add: { pitfalls: ['một bẫy nữa'] },
    });
    expect(report.card.pitfalls).toEqual(full);
    expect(report.skipped).toEqual([{ field: 'pitfalls', value: 'một bẫy nữa', reason: 'cap' }]);
  });
});

describe('mergeEnrichment — scalars replace, and the old canonical example is demoted not dropped', () => {
  it('usage and register replace; an identical value is not a change', () => {
    const base = card();
    const report = mergeGrammar(base, {
      set: { usage: 'Cách dùng đã được viết lại rõ hơn.', register: 'văn viết' },
    });
    expect(report.card.usage).toBe('Cách dùng đã được viết lại rõ hơn.');
    expect(report.card.register).toBe('văn viết');
    expect(report.replaced).toEqual(['usage', 'register']);

    const again = mergeGrammar(report.card, { set: { usage: report.card.usage } });
    expect(again.replaced).toEqual([]);
    expect(again.touched).toBe(false);
  });

  it('replacing the canonical example moves the old one into the extras', () => {
    const base = card();
    const fresh = { ja: '新しい例文です。', vi: 'Câu ví dụ mới.' };
    const report = mergeGrammar(base, { set: { example: fresh } });

    expect(report.card.example).toEqual(fresh);
    expect(report.card.examples).toContainEqual(base.example);
    expect(report.replaced).toContain('example');
  });
});

describe('mergeEnrichment — `v` means "complete under the current format", not "recently touched"', () => {
  it('stamps the current version once the patch completes the card', () => {
    const thin = card({ contrasts: [], v: 1 });
    const report = mergeGrammar(thin, {
      add: { contrasts: [{ with: '〜せいで', note: 'Sắc thái hối tiếc mạnh hơn.' }] },
    });
    expect(report.vStamped).toBe(true);
    expect(report.card.v).toBe(CURRENT_ENRICHMENT_VERSION);
  });

  it('does NOT stamp a card that is still incomplete', () => {
    const thin = card({ contrasts: [], pitfalls: [], v: 1 });
    const report = mergeGrammar(thin, { add: { collocations: ['ちょっと言ったばかりに'] } });
    expect(report.vStamped).toBe(false);
    expect(report.card.v).toBe(1);
  });
});

describe('patchFromDonor — take what I lack, never overwrite what is mine', () => {
  it('appends the donor lists and leaves my usage and canonical example alone', () => {
    const mine = card({ pitfalls: [], contrasts: [], structure: [] });
    const theirs = card({
      structure: ['名詞 + である + 〜ばかりに'],
      usage: 'CÁCH DÙNG CỦA NGƯỜI KHÁC — không được lấy.',
      example: { ja: '彼らの例文。', vi: 'Ví dụ của họ.' },
      pitfalls: ['Bẫy của họ.'],
      contrasts: [{ with: '〜だけに', note: 'Ghi chú của họ.' }],
      register: 'trang trọng',
    });

    const report = mergeGrammar(mine, patchFromDonor(mine, theirs));

    expect(report.card.usage).toBe(mine.usage);
    expect(report.card.example).toEqual(mine.example);
    expect(report.card.structure).toEqual(theirs.structure);
    expect(report.card.pitfalls).toEqual(theirs.pitfalls);
    expect(report.card.contrasts).toEqual(theirs.contrasts);
    expect(report.card.examples).toContainEqual(theirs.example);
    expect(report.card.register).toBe('trang trọng');
  });

  it('never overwrites a register I already set', () => {
    const mine = card({ register: 'thân mật' });
    const theirs = card({ register: 'trang trọng' });
    const report = mergeGrammar(mine, patchFromDonor(mine, theirs));
    expect(report.card.register).toBe('thân mật');
    expect(report.replaced).not.toContain('register');
  });
});

describe('vocabulary relations merge like every other list (2026-08-12)', () => {
  function word(over: Partial<Enrichment> = {}): Enrichment {
    return {
      structure: [],
      usage: 'Giữ đúng điều đã hứa; trang trọng hơn khi nói về nghĩa vụ.',
      collocations: ['約束を守る', '約束を破る'],
      example: { ja: '約束を守ってくれてありがとう。', vi: 'Cảm ơn vì đã giữ lời hứa.' },
      examples: [{ ja: '彼は約束を守らない。', vi: 'Anh ấy không giữ lời hứa.' }],
      pitfalls: ['Không nhầm với 護る (bảo vệ).'],
      contrasts: [],
      synonyms: [],
      antonyms: [],
      v: 1,
      ...over,
    };
  }
  const mergeVocab = (base: Enrichment, patch: EnrichmentPatch) =>
    mergeEnrichment(base, patch, VOCAB_KIND);

  it('adding a synonym reports it and keeps everything else', () => {
    const base = word();
    const report = mergeVocab(base, {
      add: { synonyms: [{ term: '果たす', reading: 'はたす', vi: 'thực hiện xong (nghĩa vụ)' }] },
    });
    expect(report.added.synonyms).toBe(1);
    expect(report.card.synonyms[0]?.term).toBe('果たす');
    expect(report.card.collocations).toEqual(base.collocations);
    expect(report.card.pitfalls).toEqual(base.pitfalls);
  });

  it('the SAME word with a reworded gloss is a duplicate — the stored gloss wins', () => {
    const base = word({ synonyms: [{ term: '果たす', vi: 'thực hiện xong' }] });
    const report = mergeVocab(base, {
      add: { synonyms: [{ term: '果たす', vi: 'hoàn thành (cách nói khác)' }] },
    });
    expect(report.added.synonyms).toBeUndefined();
    expect(report.card.synonyms).toHaveLength(1);
    expect(report.card.synonyms[0]?.vi).toBe('thực hiện xong');
    expect(report.skipped).toEqual([
      { field: 'synonyms', value: '果たす', reason: 'duplicate' },
    ]);
  });

  it('overflow past the cap is REPORTED, never silently dropped', () => {
    const full = Array.from({ length: ENRICHMENT_CAPS.synonyms }, (_, i) => ({
      term: `語${i}`,
      vi: `nghĩa ${i}`,
    }));
    const report = mergeVocab(word({ synonyms: full }), {
      add: { synonyms: [{ term: '果たす', vi: 'thực hiện xong' }] },
    });
    expect(report.card.synonyms).toHaveLength(ENRICHMENT_CAPS.synonyms);
    expect(report.skipped).toEqual([{ field: 'synonyms', value: '果たす', reason: 'cap' }]);
  });

  it('a patch that completes a word card stamps the CURRENT version', () => {
    const base = word();
    const patch: EnrichmentPatch = {
      add: { antonyms: [{ term: '破る', reading: 'やぶる', vi: 'phá, không giữ (lời hứa)' }] },
    };
    expect(mergeVocab(base, patch).vStamped).toBe(true);
    expect(mergeVocab(base, patch).card.v).toBe(CURRENT_ENRICHMENT_VERSION);
    expect(mergeGrammar(base, patch).vStamped).toBe(false);
  });

  it('taking the missing parts from a better copy brings the relations along', () => {
    const donor = word({
      synonyms: [{ term: '果たす', vi: 'thực hiện xong (nghĩa vụ)' }],
      antonyms: [{ term: '破る', vi: 'phá lời hứa' }],
    });
    const report = mergeVocab(word(), patchFromDonor(word(), donor));
    expect(report.card.synonyms).toHaveLength(1);
    expect(report.card.antonyms).toHaveLength(1);
  });
});

describe('đường di trú của một thẻ ĐÃ ĐỦ nhưng format cũ', () => {
  it('patch RỖNG vẫn đóng dấu lại, nên không phải viết lại nội dung đang đúng', () => {
    const report = mergeGrammar(card({ v: 1 }), {});
    expect(report.vStamped).toBe(true);
    expect(report.touched).toBe(true);
    expect(report.card.v).toBe(CURRENT_ENRICHMENT_VERSION);
    expect(report.added).toEqual({});
    expect(report.replaced).toEqual([]);
    expect(report.card.contrasts).toEqual(card().contrasts);
  });

  it('patch rỗng trên thẻ CHƯA đủ là no-op thật — không có gì để đóng dấu', () => {
    const thin = card({ v: 1, pitfalls: [], contrasts: [] });
    const report = mergeGrammar(thin, {});
    expect(report.vStamped).toBe(false);
    expect(report.touched).toBe(false);
  });
});
