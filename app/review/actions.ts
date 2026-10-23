'use server';

import { z } from 'zod';
import { answerCard, type AnsweredCard } from '@/lib/app/quick-review';
import { getSessionUserId } from '@/lib/auth/current-user';
import { type ActionResult, parseInput } from '@/lib/core/action-result';

const answerSchema = z.discriminatedUnion('mode', [
  z.object({ itemId: z.string().min(1), mode: z.literal('flip'), remembered: z.boolean() }),
  z.object({ itemId: z.string().min(1), mode: z.literal('cloze'), choiceId: z.string().min(1) }),
]);

export async function answerCardAction(input: unknown): Promise<ActionResult<AnsweredCard>> {
  await getSessionUserId();
  const parsed = parseInput(answerSchema, input, 'Câu trả lời không hợp lệ. Tải lại trang.');
  if (!parsed.ok) return parsed;
  // No revalidatePath: every page that shows progress is force-dynamic, and revalidating would
  // re-render this session's page after each card.
  return answerCard(parsed.data);
}
