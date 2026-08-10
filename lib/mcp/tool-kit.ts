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

// `getUserId(extra)` lived here until 2026-08-06. It pulled the authenticated userId out of the MCP
// call context so each tool could thread it into the DB layer — which is exactly what the single-user
// rewrite removed: the learning tables have no `userId` column and the boundary is the login
// (AGENTS.md §Gotchas). `lib/mcp/tools/groups.ts` already said so in a comment, and no tool had
// imported it since. What still guards this surface is `withMcpAuth({ required: true })` in the route:
// a request with no valid bearer token never reaches a tool at all.

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

/**
 * Prisma throws P2025 when an update/delete targets a row that no longer exists, and it names the
 * model in `meta.modelName`. Returns that name, `''` for a P2025 that somehow carries no model, and
 * `null` when the error is not a P2025 at all — so the caller can tell "no model" from "not ours".
 */
function recordNotFoundModel(e: unknown): string | null {
  if (typeof e !== 'object' || e === null) return null;
  if (!('code' in e) || e.code !== 'P2025') return null;
  const meta: unknown = 'meta' in e ? e.meta : null;
  const model =
    typeof meta === 'object' && meta !== null && 'modelName' in meta
      ? (meta as { modelName: unknown }).modelName
      : null;
  return typeof model === 'string' ? model : '';
}

/**
 * What to tell Claude when a row is missing — and it hinges on WHOSE id was wrong.
 *
 * Until 2026-08-10 every P2025 got the same sentence: "không tìm thấy item với id đó, gọi
 * list_grammar". For a stale itemId that is exactly right. For anything else it is a false accusation
 * with an instruction attached, and Claude follows instructions: on 2026-08-08 the missing row was
 * `LearnerAbility` (a server-side singleton the caller cannot address at all), so Claude dutifully
 * re-listed the library and retried the same call nine times while every graded turn was discarded.
 * The message sent the debugging in the wrong direction for a whole session.
 *
 * So: name the model, and only offer a "fetch fresh ids and retry" recovery for the models whose id
 * the CALLER actually supplies. For the rest, say plainly that retrying cannot help — a wrong retry
 * hint is worse than no hint, because it manufactures confident wrong action.
 */
function recordNotFoundMessage(model: string): string {
  switch (model) {
    // SrsState is keyed by itemId, so its absence is a stale itemId just as much as Item's is.
    case 'Item':
    case 'SrsState':
      return 'Không tìm thấy item với id đó (có thể đã bị xoá hoặc id sai). Gọi list_grammar / list_vocab để lấy id hiện tại.';
    case 'Sentence':
      return 'Không tìm thấy câu với sentenceId đó (có thể đã bị xoá). Gọi stage_sentence để dựng lại câu, rồi chấm bằng sentenceId mới — đừng bịa id.';
    case 'Group':
    case 'GroupMember':
      return 'Không tìm thấy nhóm với id đó (có thể đã bị xoá hoặc id sai). Gọi list_groups để lấy id hiện tại.';
    case 'CalibrationProposal':
      return 'Không tìm thấy proposal với id đó. Gọi list_calibration_proposals để lấy id hiện tại.';
    default:
      return (
        `Lỗi phía server: thiếu một hàng ${model || '(không rõ bảng)'} trong cơ sở dữ liệu. ` +
        'KHÔNG phải do id bạn gửi, nên gọi lại với id khác cũng không giúp được gì — ĐỪNG thử lại lời gọi này. ' +
        'Nói với người học rằng lần ghi vừa rồi thất bại và họ cần kiểm log của app.'
      );
  }
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
      // reads tool errors and relays them, so translate it into something actionable — but the action
      // depends on WHICH row was missing, which is why the model name is carried through instead of
      // assuming an item (see recordNotFoundMessage). Everything else keeps its own message.
      const missingModel = recordNotFoundModel(e);
      if (missingModel !== null) return mcpError(recordNotFoundMessage(missingModel));
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
  // FSRS-rated via the same stage_sentence/submit_review path.
  'CONVERSATION',
  // The two SCAFFOLDED production rungs (2026-07-26). Producing Japanese is a cliff, not a step: the
  // involvement-load ladder runs JA→VI (read) < quiz (recognise) < CLOZE_PRODUCTION < GUIDED_PRODUCTION
  // < VI→JA free < CONVERSATION, and until now the app only offered the two ends. Both reuse the
  // existing get_due_items → stage_sentence → submit_review pipeline with no schema change — the same
  // trick CONVERSATION used.
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
