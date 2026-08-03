import { describe, expect, it } from 'vitest';
import { humanizeUntil, ratingLabel } from '@/lib/format';

const NOW = new Date('2026-07-06T10:00:00Z');

describe('humanizeUntil', () => {
  it('handles past, minutes, hours, days, months', () => {
    expect(humanizeUntil(new Date('2026-07-06T09:00:00Z'), NOW)).toBe('đến hạn rồi');
    expect(humanizeUntil(new Date('2026-07-06T10:10:00Z'), NOW)).toBe('10 phút nữa');
    expect(humanizeUntil(new Date('2026-07-06T15:00:00Z'), NOW)).toBe('5 giờ nữa');
    expect(humanizeUntil(new Date('2026-07-09T10:00:00Z'), NOW)).toBe('3 ngày nữa');
    expect(humanizeUntil(new Date('2026-10-06T10:00:00Z'), NOW)).toBe('3 tháng nữa');
  });
});

describe('ratingLabel', () => {
  it('maps the 4 Anki signals', () => {
    expect(ratingLabel(1)).toContain('Again');
    expect(ratingLabel(4)).toContain('Easy');
    expect(ratingLabel(9)).toBe('9');
  });
});
