import { describe, expect, it } from 'vitest';
import { CURRENT_ENRICHMENT_VERSION } from '@/lib/enrichment';
import {
  needsWork,
  QUALITY_TIERS,
  scoreEnrichment,
  TIER_LABELS,
  type QualityTier,
} from '@/lib/enrichment-quality';

/** A card that meets every completeness dimension at the CURRENT version. */
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
      const r = scoreEnrichment(raw);
      expect(r.tier).toBe('missing');
      expect(r.score).toBe(0);
      expect(r.missing.length).toBeGreaterThan(0);
      expect(r.broken).toBe(false);
    }
  });

  it('a card that fails the schema is `broken`, NOT "enriched" — the tutor gets nothing', () => {
    // The lab case: a 44-char card with no `usage`. parseEnrichment returns null, so the tutor reads
    // NOTHING — yet `list_grammar { enriched: true }` counted it as done and the backlog filter
    // (enriched: false) would never revisit it.
    const r = scoreEnrichment('{"collocations":["x"],"example":{"ja":"a","vi":"b"}}');
    expect(r.tier).toBe('broken');
    expect(r.broken).toBe(true);
    expect(needsWork(r.tier)).toBe(true);
  });

  it('not even JSON is `broken` rather than a crash', () => {
    expect(scoreEnrichment('not json at all').tier).toBe('broken');
    expect(scoreEnrichment('not json at all').v).toBe(1);
  });

  it('a one-line card parses but is `thin`, and NAMES what is missing', () => {
    const raw = JSON.stringify({
      usage: 'Chỉ vì.',
      example: { ja: 'あ', vi: 'a' },
    });
    const r = scoreEnrichment(raw);
    expect(r.tier).toBe('thin');
    // Specificity is the point: a vague nudge is useless, "thiếu: bẫy, phân biệt" is actionable.
    expect(r.missing).toContain('bẫy hay gặp');
    expect(r.missing).toContain('phân biệt mẫu gần nghĩa');
    expect(r.missing).toContain('cách chia / cách gắn');
    expect(r.score).toBeLessThan(80);
  });

  it('a too-short usage line does not count as an explanation', () => {
    const r = scoreEnrichment(completeCard({ usage: 'Chỉ vì.' }));
    expect(r.tier).toBe('thin');
    expect(r.missing).toContain('cách dùng');
  });

  it('a card COMPLETE for an older version is `outdated`, not thin', () => {
    // This is what makes "the new format" measurable: the content is fine, the SHAPE is old.
    const r = scoreEnrichment(completeCard({ v: 1 }));
    expect(r.tier).toBe('outdated');
    expect(r.missing).toEqual([]);
    expect(r.v).toBe(1);
    expect(needsWork(r.tier)).toBe(true);
  });

  it('a complete plain card at the current version is `ok` and needs nothing', () => {
    const r = scoreEnrichment(completeCard({ collocations: [], register: undefined }));
    expect(r.tier).toBe('ok');
    expect(r.missing).toEqual([]);
    expect(needsWork(r.tier)).toBe(false);
  });

  it('a detailed card is `rich`', () => {
    const r = scoreEnrichment(
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
    // Every card in the existing library predates `v`. If this regressed, the whole library would
    // read as broken overnight.
    const preVersioning = JSON.stringify({
      structure: ['動詞辞書形 + ばかりに'],
      usage: 'Diễn tả chỉ vì một lý do nhỏ mà dẫn đến kết quả xấu ngoài ý muốn.',
      collocations: [],
      example: { ja: 'あ', vi: 'a' },
      examples: [{ ja: 'い', vi: 'b' }],
      pitfalls: ['x'],
      contrasts: [{ with: 'y', note: 'z' }],
    });
    const r = scoreEnrichment(preVersioning);
    expect(r.broken).toBe(false);
    expect(r.v).toBe(1);
    expect(r.tier).toBe('outdated'); // complete, just an older shape
  });

  it('an example WITHOUT jaRuby is still a valid example', () => {
    const r = scoreEnrichment(completeCard());
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
    const before = scoreEnrichment(JSON.stringify(complete));
    const after = scoreEnrichment(
      JSON.stringify({ ...complete, provenance: { confidence: 'high' } }),
    );
    expect(before.tier).toBe(after.tier);
    expect(before.score).toBe(after.score);
    expect(before.provenance).toBeUndefined();
    expect(after.provenance).toEqual({ confidence: 'high' });
  });

  it('is reported when present, and does NOT move the quality score', () => {
    const report = scoreEnrichment(
      JSON.stringify({
        ...complete,
        provenance: { by: 'claude-opus-5', confidence: 'low', basedOn: 'lỗi của người học' },
      }),
    );
    expect(report.provenance?.by).toBe('claude-opus-5');
    expect(report.provenance?.confidence).toBe('low');
    // Who wrote it is NOT evidence about how complete it is — the tier must ignore it entirely.
    expect(report.tier).toBe(scoreEnrichment(JSON.stringify(complete)).tier);
  });

  it('a malformed provenance drops ITSELF, never the card', () => {
    // Found by writing this test: without `.catch(undefined)` on the field, one bad optional value made
    // the whole card unparseable — so the tutor would read NOTHING from an otherwise perfect card.
    // Losing an attribution is recoverable; losing the card is the failure `broken` exists to describe.
    const report = scoreEnrichment(
      JSON.stringify({ ...complete, provenance: { confidence: 'khá chắc' } }),
    );
    expect(report.tier).not.toBe('broken');
    expect(report.provenance).toBeUndefined();
  });
});
