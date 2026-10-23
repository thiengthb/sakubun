import { describe, expect, it } from 'vitest';
import { nextTurnStatus, parseRating } from '@/lib/domain/turn';

describe('nextTurnStatus', () => {
  it('a staged turn is graded once or skipped once', () => {
    expect(nextTurnStatus('staged', { type: 'grade', rating: 3 })).toEqual({
      ok: true,
      data: 'graded',
    });
    expect(nextTurnStatus('staged', { type: 'skip' })).toEqual({ ok: true, data: 'skipped' });
  });

  it('a finished turn refuses any further event and names the fix', () => {
    for (const status of ['graded', 'skipped'] as const) {
      for (const event of [{ type: 'grade', rating: 3 } as const, { type: 'skip' } as const]) {
        const result = nextTurnStatus(status, event);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain('next_turn');
      }
    }
  });
});

describe('parseRating', () => {
  it('accepts 1 to 4', () => {
    for (const r of [1, 2, 3, 4]) expect(parseRating(r)).toEqual({ ok: true, data: r });
  });

  it('refuses anything else with a short fix', () => {
    for (const bad of [0, 5, 2.5, '3', null, undefined]) {
      const result = parseRating(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/1, 2, 3 or 4/);
    }
  });
});
