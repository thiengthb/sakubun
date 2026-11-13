import { z } from 'zod';

// One grade from a study session, as the page sends it: by the server action (answerCardAction)
// or, as the page closes, in a batch to /api/review/answer (U2f).

// U2e: the device's id for a grade, sent again unchanged when a reply is lost.
const clientId = z.string().min(8).max(64);

const flip = z.object({
  itemId: z.string().min(1),
  mode: z.literal('flip'),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});
const cloze = z.object({
  itemId: z.string().min(1),
  mode: z.literal('cloze'),
  choiceId: z.string().min(1),
});

export const cardAnswerSchema = z.discriminatedUnion('mode', [
  flip.extend({ clientId: clientId.optional() }),
  cloze.extend({ clientId: clientId.optional() }),
]);

/** The most grades one closing request carries; the page splits more into several. */
export const CLOSING_GRADES_MAX = 50;

/** What the page hands the browser as it closes: every grade carries its id, so none lands twice. */
export const closingGradesSchema = z
  .array(z.discriminatedUnion('mode', [flip.extend({ clientId }), cloze.extend({ clientId })]))
  .min(1)
  .max(CLOSING_GRADES_MAX);
