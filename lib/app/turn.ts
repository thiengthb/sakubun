import type { UserDb } from '@/lib/db/user-db';
import type { Prisma } from '@/lib/generated/prisma/client';
import { err, ok, type ActionResult } from '@/lib/core/action-result';
import { getQueue } from '@/lib/app/queue';
import { recordReviews } from '@/lib/app/record-review';
import { composeSpec, type ComposeSpec, type Direction } from '@/lib/domain/compose';
import { CARD_STATE, type StudiedToday } from '@/lib/domain/queue';
import { checkStage, finalRating, nextTurnStatus, parseRating } from '@/lib/domain/turn';
import { exampleFromNotes } from '@/lib/import/openjlpt';
import { parseEnrichment } from '@/lib/library/enrichment';
import { asItemKind, type ItemKind } from '@/lib/library/item-kinds';
import { getSettings } from '@/lib/library/practice';
import { ERROR_TAGS, type ErrorTag } from '@/lib/session/error-tags';
import { hardestLevel, JLPT_LEVELS, type JlptLevel, type Settings } from '@/lib/settings/schema';
import type { RatingValue } from '@/lib/srs/srs';

// One translation turn with Claude, end to end: pick the item and how to write the sentence
// (next), store the sentence before the learner answers (stage), then grade once or skip. Every
// rule is checked here, and every error names the one call that fixes it, because the reader is a
// model. FSRS is written only through recordReviews.

export const MAX_FEEDBACK = 300;
const MAX_HINT = 120;

const ITEM_WITH_SRS = {
  id: true,
  kind: true,
  expression: true,
  reading: true,
  meaningVi: true,
  level: true,
  notes: true,
  enrichment: true,
  suspended: true,
  srs: true,
} as const;

type ItemRow = Prisma.ItemGetPayload<{ select: typeof ITEM_WITH_SRS }>;

export interface TurnCard {
  meaning: string;
  structure: string | null;
  example: { ja: string; vi: string | null } | null;
}

export interface TurnItem {
  itemId: string;
  kind: ItemKind;
  expression: string;
  reading: string | null;
  level: string;
  isNew: boolean;
}

export type NextTurn =
  | { done: false; item: TurnItem; spec: ComposeSpec; card: TurnCard; hint: string | null }
  | { done: true; nextDueAt: Date | null; today: StudiedToday };

function asLevel(level: string): JlptLevel {
  return (JLPT_LEVELS as readonly string[]).includes(level) ? (level as JlptLevel) : 'N5';
}

function specFor(item: ItemRow, settings: Settings): ComposeSpec {
  return composeSpec({
    itemLevel: asLevel(item.level),
    state: item.srs?.state ?? CARD_STATE.NEW,
    stability: item.srs?.stability ?? 0,
    learnerLevel: hardestLevel(settings.grammarLevels),
    mode: settings.directionMode,
  });
}

function cardOf(item: ItemRow): TurnCard {
  const card = parseEnrichment(item.enrichment);
  const fromNotes = exampleFromNotes(item.notes);
  const example = card
    ? { ja: card.example.ja, vi: card.example.vi || null }
    : fromNotes
      ? { ja: fromNotes.ja, vi: null }
      : null;
  return { meaning: item.meaningVi, structure: card?.structure.join(' / ') || null, example };
}

function cleanHint(hint: string | null | undefined): string | null {
  return hint?.trim().slice(0, MAX_HINT) || null;
}

async function findItem(
  db: UserDb,
  itemId: string,
): Promise<ActionResult<ItemRow & { srs: NonNullable<ItemRow['srs']> }>> {
  const item = await db.item.findUnique({ where: { id: itemId }, select: ITEM_WITH_SRS });
  if (!item || !item.srs) return err('Unknown itemId. Call next_turn, or lookup to find the item.');
  if (item.suspended) return err('This item is suspended. Call next_turn for another one.');
  return ok({ ...item, srs: item.srs });
}

export async function nextTurn(
  db: UserDb,
  input: { itemId?: string | null; hint?: string | null },
  now: Date = new Date(),
): Promise<ActionResult<NextTurn>> {
  const settings = await getSettings(db);
  let itemId = input.itemId?.trim() || null;
  if (!itemId) {
    const queue = await getQueue(db, now, 1);
    const first = queue.cards[0];
    if (!first) return ok({ done: true, nextDueAt: queue.nextDueAt, today: queue.today });
    itemId = first.id;
  }
  const found = await findItem(db, itemId);
  if (!found.ok) return found;
  const item = found.data;
  return ok({
    done: false,
    item: {
      itemId: item.id,
      kind: asItemKind(item.kind),
      expression: item.expression,
      reading: item.reading,
      level: item.level,
      isNew: item.srs.state === CARD_STATE.NEW,
    },
    spec: specFor(item, settings),
    card: cardOf(item),
    hint: cleanHint(input.hint),
  });
}

export interface StageTurnInput {
  itemId: string;
  ja: string;
  jaRuby?: string | null;
  vi: string;
  hint?: string | null;
  // Only with a hint: the learner asked for the other direction.
  direction?: Direction | null;
  // The exact words in ja that use the item, when it is used in a form the checks miss.
  uses?: string | null;
}

export interface StagedTurn {
  turnId: string;
  direction: Direction;
  // What the learner reads: the Japanese for JA_VI, the Vietnamese for VI_JA.
  show: string;
}

export async function stageTurn(
  db: UserDb,
  input: StageTurnInput,
  now: Date = new Date(),
): Promise<ActionResult<StagedTurn>> {
  const found = await findItem(db, input.itemId);
  if (!found.ok) return found;
  const item = found.data;
  const spec = specFor(item, await getSettings(db));
  const hint = cleanHint(input.hint);
  if (input.direction && input.direction !== spec.direction && !hint) {
    return err(
      "direction differs from next_turn. Pass the learner's wish as hint, or leave direction out.",
    );
  }
  const draft = {
    ja: input.ja.trim(),
    jaRuby: input.jaRuby?.trim() || null,
    vi: input.vi.trim(),
    hint,
  };
  const checked = checkStage(
    { ...draft, uses: input.uses?.trim() || null },
    { kind: asItemKind(item.kind), expression: item.expression, reading: item.reading },
    spec.lengthJa,
  );
  if (!checked.ok) return checked;

  const direction = input.direction ?? spec.direction;
  // A turn left staged was never answered: a new one replaces it rather than piling up.
  const [, turn] = await db.$transaction([
    db.turn.updateMany({ where: { status: 'staged' }, data: { status: 'skipped' } }),
    db.turn.create({
      data: { userId: db.$ownerId(), itemId: item.id, direction, ...draft, createdAt: now },
    }),
  ]);
  return ok({ turnId: turn.id, direction, show: direction === 'JA_VI' ? draft.ja : draft.vi });
}

export interface GradeTurnInput {
  turnId: string;
  answer: string;
  rating: unknown;
  hinted?: boolean;
  errorTags?: string[];
  feedback?: string | null;
}

export interface GradedTurn {
  rating: RatingValue;
  // True when Easy was lowered to Good because the learner had a hint.
  lowered: boolean;
  nextDue: Date;
}

function parseErrorTags(tags: readonly string[] | undefined): ActionResult<ErrorTag[]> {
  const list = [...new Set(tags ?? [])];
  const unknown = list.filter((t) => !(ERROR_TAGS as readonly string[]).includes(t));
  if (unknown.length > 0)
    return err(`Unknown errorTags: ${unknown.join(', ')}. Use: ${ERROR_TAGS.join(', ')}.`);
  return ok(list as ErrorTag[]);
}

function isRecordNotFound(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2025';
}

async function findTurn(db: UserDb, turnId: string) {
  return db.turn.findUnique({
    where: { id: turnId },
    select: { id: true, status: true, item: { select: { id: true, srs: true } } },
  });
}

export async function gradeTurn(
  db: UserDb,
  input: GradeTurnInput,
  now: Date = new Date(),
): Promise<ActionResult<GradedTurn>> {
  const turn = await findTurn(db, input.turnId);
  if (!turn) return err('Unknown turnId. Call next_turn, then stage_turn.');
  const parsed = parseRating(input.rating);
  if (!parsed.ok) return parsed;
  const moved = nextTurnStatus(turn.status as 'staged', { type: 'grade', rating: parsed.data });
  if (!moved.ok) return moved;
  const answer = input.answer.trim();
  if (!answer) return err("answer is empty. Send the learner's answer as they wrote it.");
  const tags = parseErrorTags(input.errorTags);
  if (!tags.ok) return tags;
  if (parsed.data <= 2 && tags.data.length === 0) {
    return err(`rating ${parsed.data} needs errorTags (one or more of: ${ERROR_TAGS.join(', ')}).`);
  }
  const feedback = input.feedback?.trim() || null;
  if (feedback && feedback.length > MAX_FEEDBACK) {
    return err(`feedback is ${feedback.length} characters; keep it under ${MAX_FEEDBACK}.`);
  }
  if (!turn.item?.srs) return err('The item of this turn was deleted. Call skip_turn.');

  const hinted = input.hinted === true;
  const rating = finalRating(parsed.data, hinted);
  const { desiredRetention } = await getSettings(db);
  // The turn row is updated only while still staged, in the same transaction as the review: of two
  // grades sent at once, the second fails as a whole and writes nothing.
  const recordedOrGone = await recordReviews(
    db,
    [{ itemId: turn.item.id, srs: turn.item.srs, rating, turnId: turn.id, errorTags: tags.data }],
    {
      retention: desiredRetention,
      now,
      channel: 'mcp',
      alsoWrite: [
        db.turn.update({
          where: { id: turn.id, status: 'staged' },
          data: {
            status: moved.data,
            answer,
            rating,
            hinted,
            errorTags: tags.data.length > 0 ? JSON.stringify(tags.data) : null,
            feedback,
            gradedAt: now,
          },
        }),
      ],
    },
  ).catch((e: unknown) => {
    if (isRecordNotFound(e)) return null;
    throw e;
  });
  if (!recordedOrGone) return err('Turn already graded. Call next_turn for a new one.');
  const [recorded] = recordedOrGone;
  return ok({ rating, lowered: rating !== parsed.data, nextDue: recorded.next.due });
}

export async function skipTurn(db: UserDb, turnId: string): Promise<ActionResult<undefined>> {
  const turn = await findTurn(db, turnId);
  if (!turn) return err('Unknown turnId. Call next_turn for a new turn.');
  const moved = nextTurnStatus(turn.status as 'staged', { type: 'skip' });
  if (!moved.ok) return moved;
  const { count } = await db.turn.updateMany({
    where: { id: turn.id, status: 'staged' },
    data: { status: moved.data },
  });
  if (count === 0) return err('Turn already finished. Call next_turn for a new one.');
  return ok(undefined);
}
