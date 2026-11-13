'use server';

import { cardAnswerSchema } from '@/lib/app/card-answer-schema';
import { answerCard, type AnsweredCard } from '@/lib/app/quick-review';
import { getUserDb } from '@/lib/auth/current-user';
import { type ActionResult, parseInput } from '@/lib/core/action-result';

export async function answerCardAction(input: unknown): Promise<ActionResult<AnsweredCard>> {
  const db = await getUserDb();
  const parsed = parseInput(cardAnswerSchema, input, 'Câu trả lời không hợp lệ. Tải lại trang.');
  if (!parsed.ok) return parsed;
  // No revalidatePath: every page that shows progress is force-dynamic, and revalidating would
  // re-render this session's page after each card.
  return answerCard(db, parsed.data);
}
