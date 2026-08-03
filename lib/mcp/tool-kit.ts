import type { createMcpHandler } from 'mcp-handler';
import { z, ZodError } from 'zod';
import { ERROR_TAGS } from '@/lib/error-tags';
import { verbatimEnvelope } from '@/lib/mcp/render';
import { JLPT_LEVELS } from '@/lib/settings-schema';

// Shared plumbing for the MCP tool modules in `tools/`: result wrappers, the per-tool guard, and the
// Zod primitives every group reuses. No tool lives here — see `_INDEX.md`.

/** The `server` handed to the `createMcpHandler` callback — derived so we don't depend on SDK internals. */
export type McpServer = Parameters<Parameters<typeof createMcpHandler>[0]>[0];

/** Wrap a result into a CallToolResult JSON. */
export function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

/**
 * Resolve the authenticated user's id from the MCP call context (the SDK hands each tool an `extra`
 * as its 2nd arg). `withMcpAuth` in the route verified the bearer token and stashed the userId here;
 * a request without it never reaches a tool (required: true), so this is defense-in-depth — every
 * tool that touches user data threads this id into the practice.ts DB layer (plan 2026-07-21, 2.7).
 */
export function getUserId(extra: unknown): string {
  const authInfo = (extra as { authInfo?: { extra?: { userId?: unknown } } } | undefined)?.authInfo;
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== 'string' || !userId) {
    throw new Error('MCP request without an authenticated user — token missing or unrecognised.');
  }
  return userId;
}

/** "Soft" MCP error — returned as isError, NOT thrown (avoids a raw -32603). */
export function mcpError(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const };
}

/**
 * Markdown block first (the display contract — Claude pastes it or reads it as-is), then the raw
 * JSON fenced for programmatic use. Pattern from yakudoku's render.ts.
 * `verbatim: true` (user-facing blocks: Kết quả lượt này / Tiến độ / Điểm yếu) prepends an in-result display order — the
 * strongest placement, since the client model reads the tool result right before replying.
 * `verbatim: false` = Claude-only planning sheet (its own do-NOT-show warning is inside the block).
 */
export function okWithMarkdown(markdown: string, data: unknown, { verbatim = true } = {}) {
  const block = verbatim ? verbatimEnvelope(markdown) : markdown;
  return {
    content: [
      {
        type: 'text' as const,
        text: `${block}\n\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\``,
      },
    ],
  };
}

/**
 * `okWithMarkdown` plus Claude-facing notes appended AFTER the verbatim block.
 *
 * Never inside it: the block owns the numbered menu, so a second numbered list makes "1" ambiguous.
 * Nulls are dropped, so a caller can pass every note it might have and a quiet result stays quiet.
 * Used by the consent guard, the calibration shadow and the teach-back harvest — one place, so a note
 * can never accidentally land inside the block on one tool and outside it on another.
 */
export function okWithNotes(
  markdown: string,
  data: unknown,
  notes: readonly (string | null)[],
  opts?: { verbatim?: boolean },
) {
  const out = okWithMarkdown(markdown, data, opts);
  const extra = notes.filter((n): n is string => n !== null && n.length > 0);
  if (extra.length === 0) return out;
  return {
    content: [{ type: 'text' as const, text: `${out.content[0].text}\n\n${extra.join('\n\n')}` }],
  };
}

/** Prisma throws P2025 when an update/delete targets a row that no longer exists. */
function isRecordNotFound(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === 'P2025';
}

/** Wrap EVERY tool handler: log duration + translate ZodError into a message Claude can act on. */
export function guard<Args extends unknown[], R>(name: string, fn: (...args: Args) => Promise<R>) {
  return async (...args: Args) => {
    const start = Date.now();
    try {
      const res = await fn(...args);
      console.error(`[mcp] tool=${name} ms=${Date.now() - start}`);
      return res;
    } catch (e) {
      console.error(`[mcp] tool=${name} error`, e);
      if (e instanceof ZodError) {
        const lines = e.issues
          .map((i) => `- ${i.path.join('.') || '(gốc)'}: ${i.message}`)
          .join('\n');
        return mcpError(`Tham số không hợp lệ:\n${lines}`);
      }
      // Prisma's "record not found" message is a multi-line dump of the failed invocation. Claude
      // reads tool errors and relays them, so translate the one code we actually hit (a stale/typo'd
      // itemId) into something it can act on. Everything else keeps its own message.
      if (isRecordNotFound(e)) {
        return mcpError(
          'Không tìm thấy item với id đó (có thể đã bị xoá hoặc id sai). Gọi list_grammar / list_vocab để lấy id hiện tại.',
        );
      }
      return mcpError(e instanceof Error ? e.message : String(e));
    }
  };
}

/** A non-empty entity id (item / group / sentence) — one place to later tighten id validation. */
export const ID = z.string().min(1);
/** A batch of item ids — the shared cap (max 200) every bulk MCP mutation validates against. */
export const ITEM_IDS = z.array(ID).min(1).max(200);

export const RATING = z.number().int().min(1).max(4);
export const DIRECTION = z.enum(['JA_VI', 'VI_JA']);
export const ROLE = z.enum(['TARGET', 'SECONDARY', 'VOCAB']);
export const LEVEL = z.enum(JLPT_LEVELS);
export const ERROR_TAG = z.enum(ERROR_TAGS);
export const EXERCISE_TYPE = z.enum([
  'TRANSLATION',
  'CLOZE',
  'DIALOGUE',
  'QUIZ',
  // CONVERSATION (2026-07-23): situational PRODUCTION practice — sourceText holds the scenario brief
  // (context + register + required items), userAnswer is the learner's own Japanese utterance. Graded +
  // FSRS-rated via the same stage_sentence/submit_review path. See docs/plans/2026-07-23-conversation-mode.md.
  'CONVERSATION',
  // The two SCAFFOLDED production rungs (2026-07-26). Producing Japanese is a cliff, not a step: the
  // involvement-load ladder runs JA→VI (read) < quiz (recognise) < CLOZE_PRODUCTION < GUIDED_PRODUCTION
  // < VI→JA free < CONVERSATION, and until now the app only offered the two ends. Both reuse the
  // existing get_due_items → stage_sentence → submit_review pipeline with no schema change — the same
  // trick CONVERSATION used. See docs/plans/2026-07-26-adaptive-calibration.md §3.
  'CLOZE_PRODUCTION',
  'GUIDED_PRODUCTION',
  // TEACH_BACK (2026-07-27): the learner EXPLAINS a pattern in Vietnamese and the explanation is
  // graded — the protégé effect / self-explanation (plan 2026-07-26-agentic-tutor-loop §10). Same
  // stage_sentence → submit_review pipeline, no schema change, like CONVERSATION.
  //
  // direction is JA_VI, NOT the VI_JA the plan wrote. History renders by DIRECTION, not exerciseType
  // (components/history/history-cards.tsx): under VI_JA the learner's answer is treated as Japanese
  // content and handed to SpokenLine + Japanese TTS — which would try to read a Vietnamese
  // explanation aloud in Japanese. JA_VI puts the Japanese where it actually is: sourceText = the
  // pattern being explained (playable, invariant 9), userAnswer/suggested = Vietnamese prose (plain).
  'TEACH_BACK',
]);
