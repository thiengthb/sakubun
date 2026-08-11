import { describe, expect, it } from 'vitest';

import { scoreLabel } from '@/lib/score-label';

describe('scoreLabel', () => {
  it('lượt đã chấm hiện con số trên thang /100', () => {
    expect(scoreLabel('GRADED', 82)).toEqual({ text: '82/100', muted: false });
  });

  it('điểm 0 vẫn là một con số, không phải thiếu điểm', () => {
    // Cạm bẫy kinh điển: `score && ...` biến 0 thành rỗng. 0/100 là một kết quả có thật.
    expect(scoreLabel('GRADED', 0)).toEqual({ text: '0/100', muted: false });
  });

  it('lượt đã chấm mà THIẾU điểm phải nói ra, không trả về null', () => {
    // Đây là hồi quy của lỗi 2026-08-11: null ở đây nghĩa là ô trống trên UI, và ô trống đọc thành
    // "app không chấm".
    expect(scoreLabel('GRADED', null)).toEqual({ text: 'Chưa có điểm', muted: true });
    expect(scoreLabel('GRADED', undefined)).toEqual({ text: 'Chưa có điểm', muted: true });
  });

  it('bỏ qua là trạng thái, không phải điểm', () => {
    expect(scoreLabel('SKIPPED', null)).toEqual({ text: 'Bỏ qua', muted: true });
    // Kể cả khi hàng SKIPPED có sót điểm cũ, trạng thái vẫn thắng — nó mới là sự thật của lượt đó.
    expect(scoreLabel('SKIPPED', 70)).toEqual({ text: 'Bỏ qua', muted: true });
  });

  it('PENDING không chiếm ô điểm — PendingCard nói thay', () => {
    expect(scoreLabel('PENDING', null)).toBeNull();
  });
});
