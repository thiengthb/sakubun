import { describe, expect, it } from 'vitest';
import { chartEmptyMessage } from './chart-empty';

describe('chartEmptyMessage', () => {
  const base = { rangeLabel: '30 ngày', noun: 'lượt ôn nào' };

  it('có dữ liệu trong cửa sổ thì không nói gì (vẽ biểu đồ)', () => {
    expect(chartEmptyMessage({ ...base, hasInWindow: true, hasInYear: true })).toBeNull();
    expect(chartEmptyMessage({ ...base, hasInWindow: true, hasInYear: false })).toBeNull();
  });

  it('cửa sổ rỗng mà cả năm có thì chỉ cách xem, không chỉ báo rỗng', () => {
    expect(chartEmptyMessage({ ...base, hasInWindow: false, hasInYear: true })).toBe(
      'Chưa có lượt ôn nào trong 30 ngày gần nhất — chọn kỳ dài hơn để xem.',
    );
  });

  it('chưa từng có gì thì nói dữ liệu đến từ đâu', () => {
    expect(chartEmptyMessage({ ...base, hasInWindow: false, hasInYear: false })).toBe(
      'Chưa có lượt ôn nào. Luyện với Claude rồi quay lại đây.',
    );
  });

  it('nhãn kỳ được chép nguyên văn từ ô chọn, không tự dựng lại', () => {
    expect(
      chartEmptyMessage({ ...base, rangeLabel: '1 năm', hasInWindow: false, hasInYear: true }),
    ).toContain('trong 1 năm gần nhất');
  });
});
