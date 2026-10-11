import { describe, expect, it } from 'vitest';
import {
  fixOkurigana,
  okuriganaCandidates,
  searchForms,
  stripRuby,
  vocabAppears,
} from '@/lib/session/staging-checks';

describe('vocabAppears', () => {
  // Discord 2026-10-11: 青い空は、とてもきれいですね。 was staged with VOCAB 会う and 会う got a review.
  it('từ không có trong câu thì không tính', () => {
    expect(vocabAppears('会う', 'あう', '青い空は、とてもきれいですね。')).toBe(false);
    expect(vocabAppears('青', 'あお', '青い空は、とてもきれいですね。')).toBe(true);
  });

  it('nhận cả dạng chia và dạng viết kana', () => {
    expect(vocabAppears('会う', 'あう', '駅で友達に会いました。')).toBe(true);
    expect(vocabAppears('確認する', 'かくにんする', '書類を確認しました。')).toBe(true);
    expect(vocabAppears('あらゆる', null, 'あらゆる方法で')).toBe(true);
    expect(vocabAppears('忘れる', 'わすれる', 'もうわすれました。')).toBe(true);
  });

  it('searchForms lấy gốc kanji, không lấy mảnh kana quá ngắn', () => {
    expect(searchForms('会う', 'あう')).toEqual(['会う', '会', 'あう']);
  });
});

describe('fixOkurigana', () => {
  const known = new Map([
    ['青い', 'あおい'],
    ['食べる', 'たべる'],
  ]);

  it('bỏ okurigana bị lặp trong cách đọc', () => {
    const r = fixOkurigana('空[そら]が青[あおい]いです。', known);
    expect(r.ruby).toBe('空[そら]が青[あお]いです。');
    expect(r.fixed).toEqual(['青[あおい]い → 青[あお]い']);
  });

  it('giữ nguyên cách đọc đúng và chỗ không phải okurigana (間だ)', () => {
    expect(fixOkurigana('青[あお]い空[そら]', known).fixed).toEqual([]);
    expect(fixOkurigana('食[た]べる', known).fixed).toEqual([]);
    expect(fixOkurigana('間[あいだ]だ', new Map([['間', 'あいだ']])).fixed).toEqual([]);
  });

  it('liệt kê ứng viên tra từ điển', () => {
    expect(okuriganaCandidates('空[そら]が青[あおい]いです')).toEqual([
      '空が',
      '青い',
      '青いで',
      '青いです',
    ]);
  });

  it('stripRuby bỏ phần trong ngoặc vuông', () => {
    expect(stripRuby('空[そら]が青[あお]い')).toBe('空が青い');
  });
});
