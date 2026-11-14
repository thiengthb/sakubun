import { describe, expect, it } from 'vitest';
import { CLOSING_GRADES_MAX, closingGradesSchema } from '@/lib/app/card-answer-schema';

const grade = (n: number) => ({
  itemId: `i${n}`,
  mode: 'flip',
  rating: 3,
  clientId: `grade-${n}-0000`,
});

describe('closingGradesSchema', () => {
  it('takes up to the batch size, each grade with its id', () => {
    const full = Array.from({ length: CLOSING_GRADES_MAX }, (_, n) => grade(n));
    expect(closingGradesSchema.safeParse(full).success).toBe(true);
  });

  it('refuses one more than the batch size: the page splits longer lists', () => {
    const over = Array.from({ length: CLOSING_GRADES_MAX + 1 }, (_, n) => grade(n));
    expect(closingGradesSchema.safeParse(over).success).toBe(false);
  });

  it('refuses a grade with no id, which could land twice', () => {
    const { clientId: _, ...bare } = grade(1);
    expect(closingGradesSchema.safeParse([bare]).success).toBe(false);
  });
});
