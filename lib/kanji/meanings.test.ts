import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkMeanings, formatMeanings, meaningProblem } from '@/lib/kanji/meanings';

const KANJI = ['日', '弁', '語'];

describe('meaningProblem', () => {
  it('takes short Vietnamese senses, Japanese only in parentheses', () => {
    expect(meaningProblem('mặt trời; ngày; Nhật Bản')).toBeNull();
    expect(meaningProblem('nói năng; cơm hộp (弁当); van')).toBeNull();
  });

  it('names what is wrong', () => {
    expect(meaningProblem('')).toBe('nghĩa trống');
    expect(meaningProblem(' ngày')).toBe('có khoảng trắng thừa ở đầu hoặc cuối');
    expect(meaningProblem('một; hai; ba; bốn')).toBe('quá 3 nghĩa');
    expect(meaningProblem('ngày.')).toBe('không kết thúc bằng dấu chấm hay chấm phẩy');
    expect(meaningProblem('cơm hộp 弁当')).toBe('có chữ Nhật ngoài ngoặc');
    expect(meaningProblem('day; sun')).toBe('có vẻ là tiếng Anh');
    expect(meaningProblem('a'.repeat(61))).toBe('dài quá 60 ký tự');
  });
});

describe('checkMeanings', () => {
  it('counts what is done and refuses kanji outside the list', () => {
    expect(checkMeanings(KANJI, { 日: 'ngày', 猫: 'con mèo', 語: '' })).toEqual({
      errors: ['猫: không phải chữ Jōyō trong data/kanji/kanji.json', '語: nghĩa trống'],
      done: 1,
      missing: 2,
      total: 3,
    });
    expect(checkMeanings(KANJI, []).errors).toEqual(['file phải là một object {chữ: nghĩa}']);
  });

  it('writes one kanji per line in list order', () => {
    expect(formatMeanings(KANJI, { 語: 'lời nói', 日: 'ngày' })).toBe(
      '{\n  "日": "ngày",\n  "語": "lời nói"\n}\n',
    );
  });

  // CI keeps every batch written outside the app honest.
  it('passes on the committed data/kanji/meanings-vi.json', () => {
    const rows = JSON.parse(readFileSync('data/kanji/kanji.json', 'utf8')) as { kanji: string }[];
    const file = JSON.parse(readFileSync('data/kanji/meanings-vi.json', 'utf8'));
    const report = checkMeanings(
      rows.map((r) => r.kanji),
      file,
    );
    expect(report.errors).toEqual([]);
    expect(report.done).toBeGreaterThanOrEqual(50);
  });
});
