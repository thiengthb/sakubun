import { describe, expect, it } from 'vitest';
import { buildFuriganaMarkup, hasFurigana, parseFurigana } from '@/lib/furigana';

describe('buildFuriganaMarkup', () => {
  it('aligns the reading onto a single kanji with okurigana (the reported case)', () => {
    expect(buildFuriganaMarkup('食べる', 'たべる')).toBe('食[た]べる');
    expect(buildFuriganaMarkup('忙しい', 'いそがしい')).toBe('忙[いそが]しい');
    expect(buildFuriganaMarkup('大きい', 'おおきい')).toBe('大[おお]きい');
  });

  it('wraps a contiguous all-kanji surface whole (incl. jukujikun)', () => {
    expect(buildFuriganaMarkup('図書館', 'としょかん')).toBe('図書館[としょかん]');
    expect(buildFuriganaMarkup('今日', 'きょう')).toBe('今日[きょう]');
  });

  it('handles leading kana and internal okurigana', () => {
    expect(buildFuriganaMarkup('お茶', 'おちゃ')).toBe('お茶[ちゃ]');
    expect(buildFuriganaMarkup('申し込む', 'もうしこむ')).toBe('申[もう]し込[こ]む');
  });

  it('keeps the 〜 placeholder literal and annotates the kanji inside a grammar pattern', () => {
    expect(buildFuriganaMarkup('〜に対して', 'にたいして')).toBe('〜に対[たい]して');
  });

  it('strips a 〜 the reading itself carries (Claude echoes the surface placeholder)', () => {
    expect(buildFuriganaMarkup('〜って感じ', '〜ってかんじ')).toBe('〜って感[かん]じ');
    expect(buildFuriganaMarkup('〜とか言って', '〜とかいって')).toBe('〜とか言[い]って');
  });

  it('returns null when there is no kanji to annotate', () => {
    expect(buildFuriganaMarkup('ながら', 'ながら')).toBeNull();
    expect(buildFuriganaMarkup('〜ばかり', 'ばかり')).toBeNull();
  });

  it('returns null (no wrong ruby) when a mixed surface cannot be aligned', () => {
    expect(buildFuriganaMarkup('食べる', 'のむ')).toBeNull();
  });

  it('produces markup that round-trips through parseFurigana', () => {
    const m = buildFuriganaMarkup('申し込む', 'もうしこむ')!;
    expect(parseFurigana(m)).toEqual([
      { text: '申', reading: 'もう' },
      { text: 'し' },
      { text: '込', reading: 'こ' },
      { text: 'む' },
    ]);
  });
});

describe('parseFurigana', () => {
  it('splits plain kana off from the trailing kanji base of each reading', () => {
    expect(parseFurigana('彼[かれ]は忙[いそが]しい')).toEqual([
      { text: '彼', reading: 'かれ' },
      { text: 'は' },
      { text: '忙', reading: 'いそが' },
      { text: 'しい' },
    ]);
  });

  it('handles a sentence with no annotations as one plain segment', () => {
    expect(parseFurigana('これはペンです')).toEqual([{ text: 'これはペンです' }]);
  });

  it('keeps a bracket with no kanji base literal (malformed input degrades)', () => {
    expect(parseFurigana('あ[read]')).toEqual([{ text: 'あ' }, { text: '[read]' }]);
  });

  it('swallows empty brackets on both kana and kanji (the [] leak)', () => {
    expect(parseFurigana('この[]ネックレス[]は[]高[]くない[]。')).toEqual([
      { text: 'この' },
      { text: 'ネックレス' },
      { text: 'は' },
      { text: '高' },
      { text: 'くない' },
      { text: '。' },
    ]);
    expect(hasFurigana('この[]ネックレス[]は[]高[]くない[]。')).toBe(false);
  });

  it('handles multi-kanji compounds and a trailing tail', () => {
    expect(parseFurigana('勉強[べんきょう]する')).toEqual([
      { text: '勉強', reading: 'べんきょう' },
      { text: 'する' },
    ]);
  });

  it('hasFurigana is true only with a real annotation', () => {
    expect(hasFurigana('彼[かれ]は')).toBe(true);
    expect(hasFurigana('これはペン')).toBe(false);
    expect(hasFurigana('')).toBe(false);
    expect(hasFurigana(null)).toBe(false);
  });
});
