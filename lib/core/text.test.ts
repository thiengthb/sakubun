import { describe, expect, it } from 'vitest';
import { cleanText, cleanTextOrNull, cleanVocabTerm } from '@/lib/core/text';

describe('cleanText', () => {
  it('strips the MAZII-import nbsp padding that leaked into the history tag', () => {
    expect(cleanText('～のを&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;')).toBe('～のを');
  });

  it('decodes common named + numeric entities', () => {
    expect(cleanText('A&amp;B')).toBe('A&B');
    expect(cleanText('&lt;tag&gt;')).toBe('<tag>');
    expect(cleanText('&#39;x&#39;')).toBe("'x'");
    expect(cleanText('&#x3042;')).toBe('あ');
  });

  it('folds every whitespace kind (incl. U+00A0) and trims', () => {
    expect(cleanText('  a  b\t\nc  ')).toBe('a b c');
  });

  it('leaves a bare ampersand (no trailing ;) untouched', () => {
    expect(cleanText('A & B')).toBe('A & B');
  });

  it('leaves already-clean text unchanged (idempotent)', () => {
    expect(cleanText('～のを')).toBe('～のを');
    expect(cleanText(cleanText('～のを&nbsp;'))).toBe('～のを');
  });
});

describe('cleanTextOrNull', () => {
  it('returns null for nullish and whitespace/entity-only input', () => {
    expect(cleanTextOrNull(null)).toBeNull();
    expect(cleanTextOrNull(undefined)).toBeNull();
    expect(cleanTextOrNull('&nbsp;&nbsp;')).toBeNull();
  });

  it('cleans a real value', () => {
    expect(cleanTextOrNull(' やすい&nbsp;')).toBe('やすい');
  });
});

describe('cleanVocabTerm', () => {
  it('leaves a plain word untouched', () => {
    expect(cleanVocabTerm('言葉')).toBe('言葉');
    expect(cleanVocabTerm('お茶')).toBe('お茶');
  });

  it('strips the capture-reason label Claude appends', () => {
    expect(cleanVocabTerm('言葉(chưa hiểu)')).toBe('言葉');
    expect(cleanVocabTerm('言葉 (dùng sai)')).toBe('言葉');
    expect(cleanVocabTerm('言葉（chưa hiểu）')).toBe('言葉');
  });

  it('strips the quoting brackets Claude shows words in', () => {
    expect(cleanVocabTerm('「言葉」')).toBe('言葉');
    expect(cleanVocabTerm('『言葉』')).toBe('言葉');
    expect(cleanVocabTerm('"言葉"')).toBe('言葉');
  });

  it('strips both layers at once', () => {
    expect(cleanVocabTerm('「言葉」(chưa hiểu)')).toBe('言葉');
    expect(cleanVocabTerm('  「お茶」 （おちゃ） ')).toBe('お茶');
  });

  it('returns empty when only decoration was sent, so the caller can reject', () => {
    expect(cleanVocabTerm('(chưa hiểu)')).toBe('');
    expect(cleanVocabTerm('「」')).toBe('');
    expect(cleanVocabTerm('   ')).toBe('');
  });

  it('would preserve a parenthesised grammar-ish surface if the wrapper is not a full wrap', () => {
    expect(cleanVocabTerm('（お）茶')).toBe('（お）茶');
  });
});
