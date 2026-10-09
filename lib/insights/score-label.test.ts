import { describe, expect, it } from 'vitest';

import { scoreLabel } from '@/lib/insights/score-label';

describe('scoreLabel', () => {
  it('lượt đã chấm hiện con số trên thang /100', () => {
    expect(scoreLabel('GRADED', 82)).toEqual({ text: '82/100', muted: false });
  });

  it('điểm 0 vẫn là một con số, không phải thiếu điểm', () => {
    expect(scoreLabel('GRADED', 0)).toEqual({ text: '0/100', muted: false });
  });

  it('lượt đã chấm mà THIẾU điểm phải nói ra, không trả về null', () => {
    expect(scoreLabel('GRADED', null)).toEqual({ text: 'Chưa có điểm', muted: true });
    expect(scoreLabel('GRADED', undefined)).toEqual({ text: 'Chưa có điểm', muted: true });
  });

  it('bỏ qua là trạng thái, không phải điểm', () => {
    expect(scoreLabel('SKIPPED', null)).toEqual({ text: 'Bỏ qua', muted: true });
    expect(scoreLabel('SKIPPED', 70)).toEqual({ text: 'Bỏ qua', muted: true });
  });

  it('PENDING không chiếm ô điểm — PendingCard nói thay', () => {
    expect(scoreLabel('PENDING', null)).toBeNull();
  });
});
