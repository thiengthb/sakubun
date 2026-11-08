import { describe, expect, it } from 'vitest';
import { resultBlock, untilVi } from '@/lib/domain/result-block';

const NOW = new Date('2026-11-07T10:00:00Z');
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

describe('resultBlock', () => {
  it('a right answer still gets the reference, and the other way to say it', () => {
    expect(
      resultBlock({
        rating: 3,
        nextDue: later(6 * 24 * 60),
        now: NOW,
        answer: 'Tuần trước tôi đi xem phim với bạn.',
        reference: 'Tuần trước tôi đã đi xem phim với bạn.',
        feedback: 'Có thể thêm "đã" cho rõ quá khứ.',
      }),
    ).toEqual([
      '**Đúng · Nhớ** · ôn lại sau 6 ngày',
      '',
      '> **Bạn viết:** Tuần trước tôi đi xem phim với bạn.',
      '> **Tham khảo:** Tuần trước tôi đã đi xem phim với bạn.',
      '',
      '**Cách nói khác:** Có thể thêm "đã" cho rõ quá khứ.',
    ]);
  });

  it('a wrong answer names the main mistake; no feedback, no line', () => {
    const wrong = resultBlock({
      rating: 1,
      nextDue: later(10),
      now: NOW,
      answer: '友達に映画を見ました。',
      reference: '友達と映画を見に行きました。',
      feedback: '「と」 là "cùng với".',
    });
    expect(wrong[0]).toBe('**Chưa đúng · Quên** · ôn lại sau 10 phút');
    expect(wrong.at(-1)).toBe('**Lỗi chính:** 「と」 là "cùng với".');
    const bare = resultBlock({
      rating: 2,
      nextDue: later(120),
      now: NOW,
      answer: 'a',
      reference: 'b',
      feedback: null,
    });
    expect(bare[0]).toBe('**Đúng ý, còn lỗi · Khó** · ôn lại sau 2 giờ');
    expect(bare).toHaveLength(4);
  });
});

describe('untilVi', () => {
  it('keeps each line of the block whole when the answer has line breaks', () => {
    const block = resultBlock({
      rating: 3,
      nextDue: new Date(NOW.getTime() + 86_400_000),
      now: NOW,
      answer: 'Chỉ vì trễ\n  nên lỡ tàu.',
      reference: 'Chỉ vì trễ một chút mà lỡ tàu.',
      feedback: null,
    });
    expect(block).toContain('> **Bạn viết:** Chỉ vì trễ nên lỡ tàu.');
    expect(block.every((line) => !line.includes('\n'))).toBe(true);
  });

  it('says minutes, hours or days', () => {
    expect(untilVi(later(0), NOW)).toBe('1 phút');
    expect(untilVi(later(59), NOW)).toBe('59 phút');
    expect(untilVi(later(60 * 47), NOW)).toBe('47 giờ');
    expect(untilVi(later(60 * 48), NOW)).toBe('2 ngày');
  });
});
