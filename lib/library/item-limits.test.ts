import { describe, expect, it } from 'vitest';
import { ITEM_LIMITS, itemLimitError, itemTextError, normalizeHanviet } from './item-limits';

describe('item length limits', () => {
  it('lets a value at the limit through and stops one over it', () => {
    expect(itemTextError('expression', 'あ'.repeat(ITEM_LIMITS.expression))).toBeNull();
    expect(itemTextError('expression', 'あ'.repeat(ITEM_LIMITS.expression + 1))).toMatch(
      /^Từ \/ mẫu tối đa 20 ký tự, đang có 21\./,
    );
    expect(itemTextError('meaningVi', 'ữ'.repeat(ITEM_LIMITS.meaningVi + 1))).toMatch(
      /^Nghĩa tối đa 60/,
    );
    expect(itemTextError('reading', 'か'.repeat(31))).toMatch(/^Cách đọc tối đa 30/);
    expect(itemTextError('hanviet', 'A'.repeat(31))).toMatch(/^Âm Hán Việt tối đa 30/);
    expect(itemTextError('hanviet', null)).toBeNull();
  });

  it('counts Vietnamese letters once, decomposed or not, and ignores outer spaces', () => {
    const meaning = 'ữ'.repeat(ITEM_LIMITS.meaningVi).normalize('NFD');
    expect(itemTextError('meaningVi', `  ${meaning}  `)).toBeNull();
  });

  it('names the first field over its limit', () => {
    expect(itemLimitError({ expression: '〜ばかりに', meaningVi: 'x'.repeat(61) })?.field).toBe(
      'meaningVi',
    );
    expect(itemLimitError({ expression: '〜ばかりに', meaningVi: 'chỉ vì' })).toBeNull();
  });

  it('keeps an old long value on edit, and checks it once it changes', () => {
    const long = 'x'.repeat(80);
    expect(
      itemLimitError({ meaningVi: long, notes: 'y' } as never, { meaningVi: long }),
    ).toBeNull();
    expect(itemLimitError({ meaningVi: `${long}!` }, { meaningVi: long })?.field).toBe('meaningVi');
  });

  it('stores Hán Việt in upper case', () => {
    expect(normalizeHanviet('phối lự')).toBe('PHỐI LỰ');
    expect(normalizeHanviet(null)).toBeNull();
  });
});
