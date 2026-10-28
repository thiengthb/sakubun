import { z } from 'zod';
import type { ActionResult } from '@/lib/core/action-result';
import { addLibraryItems, findItems, type FoundItem } from '@/lib/app/library';
import { getStatus, type StudyStatus } from '@/lib/app/status';
import {
  gradeTurn,
  nextTurn,
  skipTurn,
  stageTurn,
  type GradedTurn,
  type NextTurn,
  type StagedTurn,
} from '@/lib/app/turn';
import { CARD_STATE } from '@/lib/domain/queue';
import { guard, learnerDb, mcpError, type McpServer, type ToolExtra } from '@/lib/mcp/tool-kit';
import { findShared } from '@/lib/mcp/tools/library';
import { ERROR_TAGS } from '@/lib/session/error-tags';
import { JLPT_LEVELS } from '@/lib/settings/schema';

// MCP v2 (roadmap 3.1): seven tools, server-led. Every result is a few plain lines ending in a
// `next:` line that tells Claude the one call to make, so the protocol stays short and a weaker
// model still follows the loop. Rules live in lib/app/turn.ts, not in these descriptions.

const RATING_NAMES = ['', 'Again', 'Hard', 'Good', 'Easy'] as const;
const STATE_NAMES: Record<number, string> = {
  [CARD_STATE.NEW]: 'new',
  [CARD_STATE.LEARNING]: 'learning',
  [CARD_STATE.REVIEW]: 'review',
  [CARD_STATE.RELEARNING]: 'relearning',
};

function text(lines: (string | null | false)[]) {
  return {
    content: [{ type: 'text' as const, text: lines.filter(Boolean).join('\n') }],
  };
}

function fromResult<T>(result: ActionResult<T>, render: (data: T) => ReturnType<typeof text>) {
  return result.ok ? render(result.data) : mcpError(result.error);
}

export function until(due: Date, now: Date): string {
  const minutes = Math.max(1, Math.round((due.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

const DIRECTION_TEXT = {
  JA_VI: 'JA_VI (learner reads the Japanese, answers in Vietnamese)',
  VI_JA: 'VI_JA (learner reads the Vietnamese, answers in Japanese)',
} as const;

export function renderNextTurn(data: NextTurn, now: Date) {
  if (data.done) {
    return text([
      `Nothing to study now. Today: ${data.today.reviews} reviews, ${data.today.newGrammar} new grammar, ${data.today.newVocab} new vocab.`,
      data.nextDueAt ? `Next review in ${until(data.nextDueAt, now)}.` : null,
      'next: tell the learner; offer to add items or stop.',
    ]);
  }
  const { item, spec, card } = data;
  const reading = item.reading ? ` (${item.reading})` : '';
  return text([
    `item ${item.expression}${reading} · ${item.kind.toLowerCase()} ${item.level} · ${item.isNew ? 'new' : 'seen'} · itemId ${item.itemId}`,
    `write ${DIRECTION_TEXT[spec.direction]}: ja ${spec.lengthJa[0]}-${spec.lengthJa[1]} chars, ${spec.register}, other words at most ${spec.backgroundLevel}`,
    `meaning: ${card.meaning}`,
    card.structure ? `structure: ${card.structure}` : null,
    card.example
      ? `example: ${card.example.ja}${card.example.vi ? ` = ${card.example.vi}` : ''}`
      : null,
    data.hint ? `hint: ${data.hint}` : null,
    'next: write one sentence (ja and vi) that uses the item, then call stage_turn.',
  ]);
}

export function renderStaged(data: StagedTurn) {
  return text([
    `turnId ${data.turnId}`,
    `show: ${data.show}`,
    'next: show the learner only the show line, wait for their answer, then call grade_turn.',
  ]);
}

export function renderGraded(data: GradedTurn, now: Date) {
  return text([
    `graded ${data.rating} (${RATING_NAMES[data.rating]}) · next review in ${until(data.nextDue, now)}`,
    data.lowered ? 'Easy became Good because the learner had a hint.' : null,
    'next: give one or two lines of feedback in Vietnamese, then call next_turn.',
  ]);
}

export function renderNotFound(query: string, shared: string[]) {
  if (shared.length === 0) {
    return text([
      `No item matches "${query}".`,
      'next: answer from your own knowledge; offer add_items.',
    ]);
  }
  return text([
    `No item in the learner's library matches "${query}". In Kho chung:`,
    ...shared,
    'next: explain it; offer library_take (only with their yes).',
  ]);
}

export function renderFound(query: string, items: FoundItem[]) {
  if (items.length === 0) return renderNotFound(query, []);
  return text(
    items.map((i) => {
      const reading = i.reading ? ` (${i.reading})` : '';
      const state = i.suspended ? 'suspended' : (STATE_NAMES[i.state ?? -1] ?? 'no schedule');
      return `${i.itemId} · ${i.expression}${reading} · ${i.kind.toLowerCase()} ${i.level} · ${state} · ${i.meaningVi}`;
    }),
  );
}

export function renderStatus(s: StudyStatus, now: Date) {
  return text([
    `ready now ${s.ready} · left today: ${s.left.newGrammar} new grammar, ${s.left.newVocab} new vocab, ${s.left.reviews} reviews`,
    `done today: ${s.today.reviews} reviews, ${s.today.newGrammar + s.today.newVocab} new · streak ${s.streakDays} days`,
    s.ready === 0 && s.nextDueAt ? `next review in ${until(s.nextDueAt, now)}` : null,
  ]);
}

const KIND = z.enum(['GRAMMAR', 'VOCAB']);

export function registerV2Tools(server: McpServer) {
  server.tool(
    'next_turn',
    'Start a turn: the next item to practise and how to write its sentence.',
    {
      itemId: z.string().optional().describe('Practise this item instead of the queue'),
      hint: z
        .string()
        .optional()
        .describe("Learner's wish for this turn, e.g. longer, travel topic"),
    },
    guard(
      'next_turn',
      async ({ itemId, hint }: { itemId?: string; hint?: string }, extra: ToolExtra) => {
        const now = new Date();
        return fromResult(await nextTurn(learnerDb(extra), { itemId, hint }, now), (d) =>
          renderNextTurn(d, now),
        );
      },
    ),
  );

  server.tool(
    'stage_turn',
    'Save the sentence before the learner answers.',
    {
      itemId: z.string(),
      ja: z.string(),
      vi: z.string(),
      jaRuby: z.string().optional().describe('ja with readings: 漢字[かんじ]'),
      hint: z.string().optional(),
      direction: z.enum(['JA_VI', 'VI_JA']).optional().describe('Only when the hint asks for it'),
      uses: z
        .string()
        .optional()
        .describe('Words in ja that use the item, if its form is irregular'),
    },
    guard('stage_turn', async (args: Parameters<typeof stageTurn>[1], extra: ToolExtra) =>
      fromResult(await stageTurn(learnerDb(extra), args), renderStaged),
    ),
  );

  server.tool(
    'grade_turn',
    "Grade the learner's answer once: 1 wrong, 2 shaky, 3 right (usual), 4 instant and flawless.",
    {
      turnId: z.string(),
      answer: z.string().describe('As the learner wrote it'),
      rating: z.number().int().min(1).max(4),
      hinted: z.boolean().optional().describe('You gave a hint'),
      errorTags: z.array(z.enum(ERROR_TAGS)).optional().describe('Required for 1-2'),
      feedback: z.string().optional(),
    },
    guard('grade_turn', async (args: Parameters<typeof gradeTurn>[1], extra: ToolExtra) => {
      const now = new Date();
      return fromResult(await gradeTurn(learnerDb(extra), args, now), (d) => renderGraded(d, now));
    }),
  );

  server.tool(
    'skip_turn',
    'Drop the turn without grading.',
    { turnId: z.string() },
    guard('skip_turn', async ({ turnId }: { turnId: string }, extra: ToolExtra) =>
      fromResult(await skipTurn(learnerDb(extra), turnId), () =>
        text(['skipped, schedule unchanged.', 'next: call next_turn.']),
      ),
    ),
  );

  server.tool(
    'lookup',
    "Find a grammar pattern or word in the learner's library.",
    { query: z.string().min(1), kind: KIND.optional() },
    guard(
      'lookup',
      async ({ query, kind }: { query: string; kind?: 'GRAMMAR' | 'VOCAB' }, extra: ToolExtra) => {
        const db = learnerDb(extra);
        const items = await findItems(db, query, kind);
        // Not the learner's yet: say whether Kho chung has it (phase 8, L5).
        return items.length > 0
          ? renderFound(query, items)
          : renderNotFound(query, await findShared(db, query, { kind, take: 3 }));
      },
    ),
  );

  server.tool(
    'add_items',
    'Add patterns or words to the library, only after the learner agrees.',
    {
      kind: KIND,
      items: z
        .array(
          z.object({
            expression: z.string(),
            meaningVi: z.string(),
            reading: z.string().optional(),
            level: z.enum(JLPT_LEVELS).optional(),
          }),
        )
        .min(1)
        .max(20),
    },
    guard(
      'add_items',
      async (
        {
          kind,
          items,
        }: {
          kind: 'GRAMMAR' | 'VOCAB';
          items: { expression: string; meaningVi: string; reading?: string; level?: string }[];
        },
        extra: ToolExtra,
      ) => {
        const result = await addLibraryItems(learnerDb(extra), kind, items);
        return text([
          `added ${result.added}`,
          result.skipped.length > 0
            ? `skipped: ${result.skipped.map((s) => `${s.expression} (${s.reason})`).join('; ')}`
            : null,
          'next: lookup gives the itemId; next_turn with it practises one now.',
        ]);
      },
    ),
  );

  server.tool(
    'status',
    'What is due and what is left today.',
    {},
    guard('status', async (_args: Record<string, never>, extra: ToolExtra) => {
      const now = new Date();
      return renderStatus(await getStatus(learnerDb(extra), now), now);
    }),
  );
}
