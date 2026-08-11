import { describe, expect, it } from 'vitest';
import { chartEmptyMessage } from './chart-empty';

describe('chartEmptyMessage', () => {
  const base = { rangeLabel: '30 ngày', noun: 'lượt ôn nào' };

  it('có dữ liệu trong cửa sổ thì không nói gì (vẽ biểu đồ)', () => {
    expect(chartEmptyMessage({ ...base, hasInWindow: true, hasInYear: true })).toBeNull();
    // Cả ca "cửa sổ có mà cả năm lại không" — vô lý về dữ liệu, nhưng nếu xảy ra thì vẫn phải VẼ, vì
    // cửa sổ là cái đang hiển thị. Một nhánh sai ở đây sẽ che biểu đồ có dữ liệu thật.
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
    // "1 năm" chứ không phải "365 ngày": câu phải khớp CHỮ trên ô chọn ngay cạnh nó, nếu không người học
    // phải tự dịch giữa hai cách gọi cùng một kỳ.
    expect(
      chartEmptyMessage({ ...base, rangeLabel: '1 năm', hasInWindow: false, hasInYear: true }),
    ).toContain('trong 1 năm gần nhất');
  });
});
