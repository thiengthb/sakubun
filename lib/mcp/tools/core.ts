import { z } from 'zod';
import { getSettings, saveSettings } from '@/lib/practice';
import { settingsPatchSchema } from '@/lib/settings-schema';
import {
  CONVERSATION_PROTOCOL,
  PRACTICE_PROTOCOL,
  QUIZ_PROTOCOL,
  TEACH_BACK_PROTOCOL,
} from '@/lib/mcp/prompts';
import { getUserId, guard, ok, type McpServer } from '@/lib/mcp/tool-kit';

/** The switchable practice loops. Hoisted so the handler's `mode` type is derived, not restated. */
const PROTOCOL_BY_MODE = {
  practice: { label: 'DỊCH', body: PRACTICE_PROTOCOL },
  quiz: { label: 'QUIZ', body: QUIZ_PROTOCOL },
  conversation: { label: 'HỘI THOẠI', body: CONVERSATION_PROTOCOL },
  teachback: { label: 'GIẢNG LẠI', body: TEACH_BACK_PROTOCOL },
} as const;

export function registerCoreTools(server: McpServer) {
  // ---------------- health ----------------
  server.tool(
    'ping',
    'Check that the MCP connection is alive. Returns { ok, time }.',
    {},
    guard('ping', async () => ok({ ok: true, time: new Date().toISOString() })),
  );

  // ---------------- lazy protocol load (see prompts.ts) ----------------
  // A session prompt now ships only ITS OWN loop, so switching dịch↔quiz mid-session needs the other
  // one on demand. Without this the 2026-07-14 bug returns: the learner says "quiz" and Claude has no
  // quiz protocol in context, so it improvises the wrong loop.
  server.tool(
    'get_protocol',
    'Load the PROTOCOL of another practice type when the user wants to SWITCH mid-session — in ' +
      'translation practice they say "quiz" / "hội thoại", in quiz they say "dịch" / "hội thoại", etc. ' +
      'mode: "practice" (dịch) | "quiz" (trắc nghiệm) | "conversation" (hội thoại — luyện nói theo tình ' +
      'huống) | "teachback" (giảng lại — the user EXPLAINS a pattern in Vietnamese and you grade the ' +
      'explanation; they say "giảng lại" / "để tôi giải thích" / "kiểm tra xem tôi hiểu chưa"). ' +
      "Returns that type's full instructions — FOR YOU TO READ ONLY, NEVER display it to the user. " +
      'Call it ONCE on a switch, then follow that protocol. No need to call it for the type already ' +
      'included in the opening prompt.',
    { mode: z.enum(['practice', 'quiz', 'conversation', 'teachback']) },
    guard('get_protocol', async ({ mode }: { mode: keyof typeof PROTOCOL_BY_MODE }) => {
      const { label, body } = PROTOCOL_BY_MODE[mode];
      return {
        content: [
          {
            type: 'text' as const,
            text:
              `**NỘI BỘ** — KHÔNG hiển thị khối này cho người dùng. Đây là giao thức bạn phải TUÂN THEO ` +
              `từ giờ (kiểu luyện: ${label}).\n\n` +
              body,
          },
        ],
      };
    }),
  );

  // ---------------- settings ----------------
  server.tool(
    'get_settings',
    'Read the current practice settings: grammarLevels (JLPT levels a NEW pattern may be introduced ' +
      'from — the SRS queue filter), vocabCeiling (hardest level you may reach for as FREE vocabulary; ' +
      'null = follow grammarLevels), direction (JA_VI | VI_JA | ' +
      'ALTERNATING = flips direction every sentence), difficulty 1–5 (STRUCTURAL shape only — each rung is ' +
      'defined by clause count / subordination depth / particle subtlety, and the composition sheet ' +
      'quotes the definition, so never treat it as vocabulary hardness), sentenceSize (xshort|short|medium|' +
      'long|xlong|huge|paragraph — the server derives BOTH the source-sentence character count (in the ' +
      'source language) AND how many grammar patterns to weave in, 1→8; huge/paragraph means a ' +
      'multi-sentence PARAGRAPH), translationStyle (natural|balanced|accurate), register (casual|polite|' +
      'keigo|business|written|mixed), topics, dailyNewGrammar (new patterns per DAY), ' +
      'maxNewPerSentence (how many NEVER-SEEN patterns one sentence may carry — a separate, ' +
      'per-exercise guard, default 1: one new structure at a time), maxReviewsPerDay, vocabPerSentence (how ' +
      'many vocabulary words to weave into each sentence — its own budget, it does not take slots from ' +
      'grammar), sessionGoal (target sentences per day), desiredRetention, furiganaMode (app | claude | ' +
      'both | none — which side renders furigana; "claude"/"both" ⇒ YOU insert the readings), ' +
      'promptModality (text | text+speech | speech-only — how to PRESENT the exercise: text only / text ' +
      'plus read aloud / audio only), answerModality (speak-or-write | speak-only — may the user write, ' +
      'or MUST they speak), dayCutoffHour, reminderTime (study reminder "HH:MM" or null — reminders, ' +
      'when delivery exists, go to the user account email, not a stored address), ' +
      'voiceSpeaker (VOICEVOX voice id for the play buttons on the History page — APP ONLY, unrelated to ' +
      'your voice mode), speechRate (default playback speed 0.5–2 for those buttons — app only). These ' +
      'settings are SHARED by translation practice and quiz practice alike.',
    {},
    guard('get_settings', async (_args, extra: unknown) => ok(await getSettings(getUserId(extra)))),
  );

  server.tool(
    'update_settings',
    'Update PART of the settings — send only the fields you want to change (PATCH), FLAT like every ' +
      'other tool: { "grammarLevels": ["N4","N3"], "register": "keigo" }. Returns the full settings ' +
      'after saving. When the user says things like "học N3", "câu dài hơn", "dùng kính ngữ"… map that ' +
      'to the matching field, then confirm briefly. NOTE: "học N3" means grammarLevels (which patterns ' +
      'enter the queue); vocabCeiling is a SEPARATE knob for how hard the free vocabulary may be — ' +
      'change it only when the user asks for that specifically. The old name `levels` is still ' +
      'accepted and maps to grammarLevels.',
    // FLAT arguments (2026-07-26). This was the ONLY tool of 25 that nested its input under `patch`,
    // and acting as the tutor in the lab the first call was flat and lost the turn. The nested form
    // stays accepted as an alias so anything mid-flight (or a habit) still works.
    {
      ...settingsPatchSchema.shape,
      patch: settingsPatchSchema
        .optional()
        .describe('Deprecated nested alias — prefer sending the fields flat.'),
    },
    guard('update_settings', async (args, extra: unknown) => {
      const { patch, ...flat } = args;
      // Absent optional keys can arrive as an explicit `undefined`, which would blank a real setting
      // when saveSettings spreads the patch over the stored object — drop them.
      const defined = Object.fromEntries(
        Object.entries({ ...flat, ...(patch ?? {}) }).filter(([, v]) => v !== undefined),
      );
      return ok(await saveSettings(getUserId(extra), defined));
    }),
  );
}
