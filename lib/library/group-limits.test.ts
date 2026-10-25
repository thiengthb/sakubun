import { describe, expect, it } from 'vitest';
import {
  GROUP_NAME_MAX,
  GROUP_NOTE_MAX,
  groupTextError,
  textLength,
  tooLongError,
} from './group-limits';

describe('group text limits', () => {
  it('counts Vietnamese letters once, decomposed or not', () => {
    expect(textLength('Ngữ pháp')).toBe(8);
    expect(textLength('Ngữ pháp'.normalize('NFD'))).toBe(8);
    expect(textLength('〜ばかりに')).toBe(5);
  });

  it('lets a name of exactly the limit through and stops one more', () => {
    expect(groupTextError('name', 'a'.repeat(GROUP_NAME_MAX))).toBeNull();
    expect(groupTextError('name', 'ữ'.repeat(GROUP_NAME_MAX + 1))).toBe(
      `Tên nhóm tối đa ${GROUP_NAME_MAX} ký tự, đang có ${GROUP_NAME_MAX + 1}.`,
    );
  });

  it('limits the note the same way and ignores an empty one', () => {
    expect(groupTextError('note', 'b'.repeat(GROUP_NOTE_MAX))).toBeNull();
    expect(groupTextError('note', 'b'.repeat(GROUP_NOTE_MAX + 5))).toMatch(/^Ghi chú tối đa 80/);
    expect(groupTextError('note', null)).toBeNull();
    expect(groupTextError('note', '')).toBeNull();
  });

  it('does not count the spaces around the text', () => {
    expect(groupTextError('name', `  ${'a'.repeat(GROUP_NAME_MAX)}  `)).toBeNull();
  });
});

describe('tooLongError', () => {
  it('says only the limit and the count, and nothing while the text fits', () => {
    expect(tooLongError('a'.repeat(20), 20)).toBeNull();
    expect(tooLongError('', 20)).toBeNull();
    expect(tooLongError(null, 20)).toBeNull();
    expect(tooLongError('図'.repeat(25), 20)).toBe('Tối đa 20 ký tự, đang có 25.');
    // Counted after trimming, as the server does.
    expect(tooLongError(`  ${'a'.repeat(20)}  `, 20)).toBeNull();
  });
});
