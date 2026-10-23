import { err, ok, type ActionResult } from '@/lib/core/action-result';
import type { RatingValue } from '@/lib/srs/srs';

// One translation turn with Claude: exactly one target item, staged once, then either graded once or
// skipped. Every error names the one call that fixes it, because the reader is a model.

export type TurnStatus = 'staged' | 'graded' | 'skipped';

export type TurnEvent = { type: 'grade'; rating: RatingValue } | { type: 'skip' };

export function nextTurnStatus(status: TurnStatus, event: TurnEvent): ActionResult<TurnStatus> {
  if (status === 'graded') return err('Turn already graded. Call next_turn for a new one.');
  if (status === 'skipped') return err('Turn was skipped. Call next_turn for a new one.');
  return ok(event.type === 'grade' ? 'graded' : 'skipped');
}

const RATINGS: readonly number[] = [1, 2, 3, 4];

export function parseRating(value: unknown): ActionResult<RatingValue> {
  if (typeof value === 'number' && RATINGS.includes(value)) return ok(value as RatingValue);
  return err('rating must be 1, 2, 3 or 4 (1 = wrong, 4 = easy).');
}
