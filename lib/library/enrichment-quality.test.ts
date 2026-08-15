import { describe, expect, it } from 'vitest';
import { CURRENT_ENRICHMENT_VERSION } from '@/lib/library/enrichment';
import {
  needsWork,
  QUALITY_TIERS,
  scoreEnrichment,
  TIER_LABELS,
  type QualityTier,
} from '@/lib/library/enrichment-quality';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';

const score = (raw: string | null | undefined) => scoreEnrichment(raw, GRAMMAR_KIND);

function completeCard(patch: Record<string, unknown> = {}): string {
  return JSON.stringify({
    v: CURRENT_ENRICHMENT_VERSION,
    structure: ['動詞辞書形 + ばかりに'],
    usage: 'Diễn tả chỉ vì một lý do nhỏ mà dẫn đến kết quả xấu ngoài ý muốn.',
    collocations: ['油断したばかりに'],
    example: { ja: '油断したばかりに負けた。', vi: 'Chỉ vì lơ là mà đã thua.' },
    examples: [{ ja: '一言言ったばかりに喧嘩になった。', vi: 'Chỉ vì một câu mà thành cãi nhau.' }],
    pitfalls: ['Không dùng cho kết quả TỐT.'],
    contrasts: [{ with: '〜せいで', note: '〜ばかりに nhấn vào sự hối tiếc hơn.' }],
    ...patch,
  });
}

describe('scoreEnrichment — the six states', () => {
  it('no card at all is `missing`, and lists every dimension as absent', () => {
    for (const raw of [null, undefined, '', '   ']) {
      const r = score(raw);
      expect(r.tier).toBe('missing');
      expect(r.score).toBe(0);
      expect(r.missing.length).toBeGreaterThan(0);
      expect(r.broken).toBe(false);
    }
  });

  it('a card that fails the schema is `broken`, NOT "enriched" — the tutor gets nothing', () => {
    const r = score('{"collocations":["x"],"example":{"ja":"a","vi":"b"}}');
    expect(r.tier).toBe('broken');
    expect(r.broken).toBe(true);
    expect(needsWork(r.tier)).toBe(true);
  });

  it('not even JSON is `broken` rather than a crash', () => {
    expect(score('not json at all').tier).toBe('broken');
    expect(score('not json at all').v).toBe(1);
  });

  it('a one-line card parses but is `thin`, and NAMES what is missing', () => {
    const raw = JSON.stringify({
      usage: 'Chỉ vì.',
      example: { ja: 'あ', vi: 'a' },
    });
    const r = score(raw);
    expect(r.tier).toBe('thin');
    expect(r.missing).toContain('bẫy hay gặp');
    expect(r.missing).toContain('phân biệt mẫu gần nghĩa');
    expect(r.missing).toContain('cách chia / cách gắn');
    expect(r.score).toBeLessThan(80);
  });

  it('a too-short usage line does not count as an explanation', () => {
    const r = score(completeCard({ usage: 'Chỉ vì.' }));
    expect(r.tier).toBe('thin');
    expect(r.missing).toContain('cách dùng');
  });

  it('a card COMPLETE for an older version is `outdated`, not thin', () => {
    const r = score(completeCard({ v: 1 }));
    expect(r.tier).toBe('outdated');
    expect(r.missing).toEqual([]);
    expect(r.v).toBe(1);
    expect(needsWork(r.tier)).toBe(true);
  });

  it('a complete plain card at the current version is `ok` and needs nothing', () => {
    const r = score(completeCard({ collocations: [], register: undefined }));
    expect(r.tier).toBe('ok');
    expect(r.missing).toEqual([]);
    expect(needsWork(r.tier)).toBe(false);
  });

  it('a detailed card is `rich`', () => {
    const r = score(
      completeCard({
        collocations: ['油断したばかりに', '一言言ったばかりに'],
        pitfalls: ['Không dùng cho kết quả TỐT.', 'Không dùng với thể ý chí.'],
        contrasts: [
          { with: '〜せいで', note: 'a' },
          { with: '〜おかげで', note: 'b' },
        ],
        register: 'văn viết, hơi trang trọng',
      }),
    );
    expect(r.tier).toBe('rich');
    expect(r.score).toBeGreaterThan(80);
    expect(needsWork(r.tier)).toBe(false);
  });
});

describe('back-compat (the jaRuby rule: an old card must never stop parsing)', () => {
  it('a PRE-VERSIONING card still parses and is scored, defaulting to v1', () => {
    const preVersioning = JSON.stringify({
      structure: ['動詞辞書形 + ばかりに'],
      usage: 'Diễn tả chỉ vì một lý do nhỏ mà dẫn đến kết quả xấu ngoài ý muốn.',
      collocations: [],
      example: { ja: 'あ', vi: 'a' },
      examples: [{ ja: 'い', vi: 'b' }],
      pitfalls: ['x'],
      contrasts: [{ with: 'y', note: 'z' }],
    });
    const r = score(preVersioning);
    expect(r.broken).toBe(false);
    expect(r.v).toBe(1);
    expect(r.tier).toBe('outdated'); // complete, just an older shape
  });

  it('an example WITHOUT jaRuby is still a valid example', () => {
    const r = score(completeCard());
    expect(r.broken).toBe(false);
    expect(r.missing).not.toContain('ví dụ');
  });
});

describe('the tier vocabulary', () => {
  it('every tier has a Vietnamese label (one source for MCP and the web)', () => {
    for (const tier of QUALITY_TIERS) {
      expect(TIER_LABELS[tier as QualityTier]).toBeTruthy();
    }
  });

  it('exactly the four repairable tiers need work', () => {
    expect(QUALITY_TIERS.filter((t) => needsWork(t as QualityTier))).toEqual([
      'missing',
      'broken',
      'thin',
      'outdated',
    ]);
  });
});

describe('provenance — additive, optional, and never a reason a card stops parsing', () => {
  const complete = {
    v: 2,
    structure: ['動詞 + X'],
    usage: 'Một câu giải thích đủ dài để vượt qua ngưỡng tối thiểu của thẻ.',
    collocations: [],
    example: { ja: 'あ', vi: 'a' },
    examples: [{ ja: 'い', vi: 'b' }],
    pitfalls: ['x'],
    contrasts: [{ with: 'y', note: 'z' }],
  };

  it('a card written BEFORE provenance existed still parses and scores the same', () => {
    const before = score(JSON.stringify(complete));
    const after = score(
      JSON.stringify({ ...complete, provenance: { confidence: 'high' } }),
    );
    expect(before.tier).toBe(after.tier);
    expect(before.score).toBe(after.score);
    expect(before.provenance).toBeUndefined();
    expect(after.provenance).toEqual({ confidence: 'high' });
  });

  it('is reported when present, and does NOT move the quality score', () => {
    const report = score(
      JSON.stringify({
        ...complete,
        provenance: { by: 'claude-opus-5', confidence: 'low', basedOn: 'lỗi của người học' },
      }),
    );
    expect(report.provenance?.by).toBe('claude-opus-5');
    expect(report.provenance?.confidence).toBe('low');
    expect(report.tier).toBe(score(JSON.stringify(complete)).tier);
  });

  it('a malformed provenance drops ITSELF, never the card', () => {
    const report = score(
      JSON.stringify({ ...complete, provenance: { confidence: 'khá chắc' } }),
    );
    expect(report.tier).not.toBe('broken');
    expect(report.provenance).toBeUndefined();
  });
});

describe('the VOCAB bar is a different bar (2026-08-12)', () => {
  function vocabCard(patch: Record<string, unknown> = {}): string {
    return JSON.stringify({
      v: CURRENT_ENRICHMENT_VERSION,
      usage: 'Giữ đúng điều đã hứa; trang trọng hơn 守る dùng cho quy tắc.',
      collocations: ['約束を守る', '約束を破る'],
      example: { ja: '約束を守ってくれてありがとう。', vi: 'Cảm ơn vì đã giữ lời hứa.' },
      examples: [{ ja: '彼は約束を守らない。', vi: 'Anh ấy không giữ lời hứa.' }],
      pitfalls: ['Không nói 約束をする＋守る cùng lúc trong một câu ngắn.'],
      synonyms: [{ term: '果たす', reading: 'はたす', vi: 'thực hiện xong (nghĩa vụ)' }],
      antonyms: [{ term: '破る', reading: 'やぶる', vi: 'phá, không giữ (lời hứa)' }],
      ...patch,
    });
  }
  const scoreVocab = (raw: string) => scoreEnrichment(raw, VOCAB_KIND);

  it('a word card with NO synonym and NO antonym is thin, and says so in Vietnamese', () => {
    const r = scoreVocab(vocabCard({ synonyms: [], antonyms: [] }));
    expect(r.tier).toBe('thin');
    expect(r.missing).toContain('từ đồng nghĩa / trái nghĩa');
  });

  it('a synonym ALONE is enough — a word with no honest opposite is still complete', () => {
    const r = scoreVocab(vocabCard({ antonyms: [] }));
    expect(r.missing).toEqual([]);
    expect(r.tier).not.toBe('thin');
  });

  it('an example whose Vietnamese translation is only whitespace does NOT count', () => {
    const r = scoreVocab(
      vocabCard({ examples: [{ ja: '彼は約束を守らない。', vi: '  ' }] }),
    );
    expect(r.tier).toBe('thin');
    expect(r.missing).toContain('ví dụ có dịch tiếng Việt');
  });

  it('one collocation is not enough for a word (the frame is how a word is USED)', () => {
    const r = scoreVocab(vocabCard({ collocations: ['約束を守る'] }));
    expect(r.tier).toBe('thin');
    expect(r.missing).toContain('cụm / khung câu hay đi kèm');
  });

  it('a word is NOT asked for conjugation forms, and a pattern is NOT asked for synonyms', () => {
    const wordWithoutStructure = vocabCard();
    expect(scoreVocab(wordWithoutStructure).missing).toEqual([]);
    expect(scoreEnrichment(wordWithoutStructure, GRAMMAR_KIND).missing).toContain(
      'cách chia / cách gắn',
    );

    const patternWithoutSynonyms = completeCard();
    expect(score(patternWithoutSynonyms).missing).toEqual([]);
    expect(scoreEnrichment(patternWithoutSynonyms, VOCAB_KIND).missing).toContain(
      'từ đồng nghĩa / trái nghĩa',
    );
  });

  it('a word card carrying BOTH directions plus frames is rich', () => {
    const r = scoreVocab(
      vocabCard({
        collocations: ['約束を守る', '約束を破る', '約束の時間', '固い約束'],
        synonyms: [
          { term: '果たす', reading: 'はたす', vi: 'thực hiện xong (nghĩa vụ)' },
          { term: '遵守する', reading: 'じゅんしゅする', vi: 'tuân thủ (văn bản, quy định)' },
        ],
        register: 'trung tính, dùng được cả nói và viết',
      }),
    );
    expect(r.tier).toBe('rich');
    expect(needsWork(r.tier)).toBe(false);
  });

  it('an unknown kind string is scored as GRAMMAR rather than crashing', () => {
    expect(scoreEnrichment(completeCard(), 'WORD').missing).toEqual([]);
  });
});
