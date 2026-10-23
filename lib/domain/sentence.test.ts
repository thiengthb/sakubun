import { describe, expect, it } from 'vitest';
import { markSpan, segmentsText } from '@/lib/domain/sentence';

const JA = '友達と約束をしました。';
const RUBY = '友達[ともだち]と約束[やくそく]をしました。';
const SPAN = { start: 3, end: 5 }; // 約束
const SPAN_AT_0 = { start: 0, end: 2 };

describe('markSpan', () => {
  it('underlines the target and keeps its furigana', () => {
    expect(markSpan(JA, RUBY, SPAN, 'target')).toEqual([
      { text: '友達', reading: 'ともだち' },
      { text: 'と' },
      { text: '約束', reading: 'やくそく', mark: 'target' },
      { text: 'をしました。' },
    ]);
  });

  it('blanks the target with its reading, as one blank', () => {
    const segments = markSpan(JA, RUBY, SPAN, 'blank');
    expect(segmentsText(segments)).toBe('友達と（　）をしました。');
    expect(JSON.stringify(segments)).not.toContain('やくそく');
  });

  it('splits plain text around a kana target', () => {
    const ja = '写真を撮ってもいいですか。';
    const ruby = '写真[しゃしん]を撮[と]ってもいいですか。';
    const start = ja.indexOf('てもいい');
    expect(markSpan(ja, ruby, { start, end: start + 4 }, 'target')).toEqual([
      { text: '写真', reading: 'しゃしん' },
      { text: 'を' },
      { text: '撮', reading: 'と' },
      { text: 'っ' },
      { text: 'てもいい', mark: 'target' },
      { text: 'ですか。' },
    ]);
  });

  it('a target inside a longer kanji run takes the whole run', () => {
    const segments = markSpan(
      '約束日を決めた。',
      '約束日[やくそくび]を決[き]めた。',
      SPAN_AT_0,
      'target',
    );
    expect(segments[0]).toEqual({ text: '約束日', reading: 'やくそくび', mark: 'target' });
  });

  it('drops the furigana rather than leak half a reading into a blank', () => {
    const segments = markSpan(
      '約束日を決めた。',
      '約束日[やくそくび]を決[き]めた。',
      SPAN_AT_0,
      'blank',
    );
    expect(segments).toEqual([{ text: '', mark: 'blank' }, { text: '日を決めた。' }]);
  });

  it('falls back to plain text when the markup is missing or spells another sentence', () => {
    expect(markSpan(JA, null, SPAN, 'target')).toEqual([
      { text: '友達と' },
      { text: '約束', mark: 'target' },
      { text: 'をしました。' },
    ]);
    expect(markSpan(JA, '友達[ともだち]と会[あ]った。', SPAN, 'target')).toHaveLength(3);
  });
});
