import { describe, expect, it } from 'vitest';
import { withExample } from '@/lib/library/example-add';
import { ENRICHMENT_CAPS, parseEnrichment } from '@/lib/library/enrichment';
import { scoreEnrichment } from '@/lib/library/enrichment-quality';

const AU = { kind: 'VOCAB', expression: '会う', reading: 'あう' };
const SENTENCE = { ja: '駅で友達に会った。', vi: 'Tôi đã gặp bạn ở nhà ga.' };

const card = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    structure: ['N に 会う'],
    usage: 'gặp ai đó',
    example: { ja: '先生に会います。', vi: 'Tôi gặp thầy.' },
    note: 'a field this version does not know',
    ...extra,
  });

describe('withExample', () => {
  it('gives an item with no card one that holds only the sentence, counted as thin', () => {
    const result = withExample(null, AU, {
      ...SENTENCE,
      jaRuby: '駅[えき]で友達[ともだち]に会[あ]った。',
    });
    expect(result).toMatchObject({ ok: true, data: { created: true, sentences: 1 } });
    if (!result.ok) return;
    expect(parseEnrichment(result.data.enrichment)).toMatchObject({
      usage: '',
      example: { ...SENTENCE, jaRuby: '駅[えき]で友達[ともだち]に会[あ]った。' },
    });
    expect(scoreEnrichment(result.data.enrichment, 'VOCAB').tier).toBe('thin');
  });

  it('adds to an existing card and keeps what it does not know', () => {
    const result = withExample(card(), AU, SENTENCE);
    expect(result).toMatchObject({ ok: true, data: { created: false, sentences: 2 } });
    if (!result.ok) return;
    const stored = JSON.parse(result.data.enrichment);
    expect(stored.note).toBe('a field this version does not know');
    expect(stored.examples).toEqual([SENTENCE]);
  });

  it('accepts a conjugated word and a pattern in any of its forms', () => {
    expect(withExample(null, AU, { ja: '昨日会いました。', vi: 'Hôm qua đã gặp.' }).ok).toBe(true);
    const tara = { kind: 'GRAMMAR', expression: '〜たら', reading: null };
    expect(
      withExample(null, tara, { ja: '雨が降ったら、行かない。', vi: 'Nếu mưa thì không đi.' }).ok,
    ).toBe(true);
  });

  it('refuses a sentence that would mislead, saying what to fix', () => {
    const refuse = (
      input: { ja: string; vi: string; jaRuby?: string },
      raw: string | null = null,
    ) => {
      const result = withExample(raw, AU, input);
      return result.ok ? null : result.error;
    };
    expect(refuse({ ja: '駅で友達を待った。', vi: 'x' })).toContain('does not use 会う');
    expect(refuse({ ja: SENTENCE.ja, vi: '会った' })).toContain('Vietnamese');
    expect(refuse({ ja: SENTENCE.ja, vi: '' })).toContain('Vietnamese');
    expect(refuse({ ...SENTENCE, jaRuby: '駅[えき]で会[あ]った。' })).toContain('jaRuby');
    expect(refuse({ ja: '会'.repeat(90), vi: 'x' })).toContain('too long');
    expect(refuse({ ja: '先生に会います。', vi: 'x' }, card())).toContain('already has');
    expect(refuse(SENTENCE, '{"usage":')).toContain('broken');
    const full = card({
      examples: Array.from({ length: ENRICHMENT_CAPS.examples }, (_, i) => ({
        ja: `友達に${i}回会った。`,
        vi: 'x',
      })),
    });
    expect(refuse(SENTENCE, full)).toContain('full');
  });
});
