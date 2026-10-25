import { describe, expect, it } from 'vitest';
import { GROUP_NAME_MAX, GROUP_NOTE_MAX, groupTextError, textLength } from './group-limits';

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
