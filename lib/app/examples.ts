import type { UserDb } from '@/lib/db/user-db';
import { err, ok, type ActionResult } from '@/lib/core/action-result';
import { withExample, type NewExample } from '@/lib/library/example-add';

// MCP example_add: one sentence with its Vietnamese onto an item's card, where quick review takes
// it from (lib/app/quick-review.ts). The checks are in lib/library/example-add.ts.

export interface AddedExample {
  expression: string;
  created: boolean;
  sentences: number;
}

export async function addExample(
  db: UserDb,
  itemId: string,
  input: NewExample,
): Promise<ActionResult<AddedExample>> {
  const item = await db.item.findFirst({
    where: { id: itemId },
    select: { id: true, kind: true, expression: true, reading: true, enrichment: true },
  });
  if (!item) return err(`No item ${itemId}. lookup gives the itemId.`);
  const result = withExample(item.enrichment, item, input);
  if (!result.ok) return result;
  // Only if the card is still the one read above: a write in between is not overwritten.
  const { count } = await db.item.updateMany({
    where: { id: item.id, enrichment: item.enrichment },
    data: { enrichment: result.data.enrichment },
  });
  if (count === 0) return err('The card changed while adding. Call example_add again.');
  const { created, sentences } = result.data;
  return ok({ expression: item.expression, created, sentences });
}
