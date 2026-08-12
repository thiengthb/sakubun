import { createMcpHandler } from 'mcp-handler';
import {
  CONVERSATION_SESSION,
  PRACTICE_SESSION,
  QUIZ_SESSION,
  TEACH_BACK_SESSION,
} from '@/lib/mcp/prompts';
import { registerContentTools } from '@/lib/mcp/tools/content';
import { registerCoreTools } from '@/lib/mcp/tools/core';
import { registerGroupTools } from '@/lib/mcp/tools/groups';
import { registerLookupTools } from '@/lib/mcp/tools/lookup';
import { registerManageTools } from '@/lib/mcp/tools/manage';
import { registerPracticeTools } from '@/lib/mcp/tools/practice';
import { registerQuizTools } from '@/lib/mcp/tools/quiz';
import { setToolCallRecorder } from '@/lib/mcp/tool-kit';
import { recordToolCall } from '@/lib/mcp/usage';

// Every tool goes through `guard()`, and from here on `guard()` counts what it already logged: which
// tool was called, how long it took, and what went wrong. The log line still happens; it just no
// longer has to be the only copy (lib/mcp/usage.ts explains why).
setToolCallRecorder(recordToolCall);

/**
 * sakubun MCP server — the app is the deterministic data + FSRS layer; Claude (the MCP client) is
 * BOTH the sentence generator and the grader. Multi-user + authed (2026-07-21): each call carries a
 * per-user bearer token verified in the route, and getUserId(extra) scopes every tool to that user.
 *
 * This file is only WIRING: the tool definitions live in `tools/*.ts` (grouped as they were sectioned
 * here), the shared helpers in `tool-kit.ts`, and the tutor protocol prose in `prompts.ts`.
 */
export const mcpHandler = createMcpHandler(
  (server) => {
    registerCoreTools(server);
    registerContentTools(server);
    registerPracticeTools(server);
    registerManageTools(server);
    registerLookupTools(server);
    registerQuizTools(server);
    // Study groups (restored 2026-08-05). The catalog already advertised these five tools the whole
    // time they were gone — lib/mcp/catalog.ts lines 146+ — so Claude could read the names and get
    // "unknown tool" on every call.
    registerGroupTools(server);

    // ---------------- Prompt: the full tutor protocol ----------------
    server.prompt(
      'practice',
      'Bắt đầu buổi luyện DỊCH (mặc định): đọc get_settings + get_stats, hỏi trọng tâm → soạn câu → chấm + rating 1–4. Muốn QUIZ trắc nghiệm A–D thì nói "quiz" (hoặc chạy prompt quiz) — chuyển được bất cứ lúc nào, cùng một bộ cài đặt.',
      async () => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: PRACTICE_SESSION,
            },
          },
        ],
      }),
    );

    // ---------------- Prompt: multiple-choice quiz ----------------
    // Both prompts return the SAME protocol; the learner picks dịch vs quiz by intent (and may switch
    // mid-session). This entry point just biases the default toward quiz for discoverability.
    server.prompt(
      'quiz',
      'Bắt đầu buổi luyện QUIZ TRẮC NGHIỆM: mỗi câu xoáy vào MỘT mẫu ngữ pháp, một chỗ trống (＿＿) trong câu và 4 đáp án A–D (mẫu đúng + 3 mẫu dễ nhầm) — bạn CHỌN một chữ cái, Claude chấm (rating 1–4). Nói "dịch" để chuyển sang luyện dịch.',
      async () => ({
        messages: [{ role: 'user', content: { type: 'text', text: QUIZ_SESSION } }],
      }),
    );

    // ---------------- Prompt: situational conversation (production) ----------------
    // The third practice type (2026-07-23). Unlike practice/story_practice (which are TRANSLATION), the
    // learner composes their OWN Japanese utterance to fit a scenario Claude designs — the context sets
    // the relationship, which sets the register. Same FSRS path as the others (stage → submit).
    server.prompt(
      'conversation',
      'Bắt đầu buổi luyện HỘI THOẠI theo tình huống: Claude dựng một bối cảnh thật (bạn là ai, nói với ai, ở đâu), nêu rõ văn phong + các mẫu ngữ pháp/từ vựng cần dùng, rồi BẠN tự nói câu tiếng Nhật hợp cảnh — chấm cả mức độ hợp văn phong lẫn cách dùng mẫu (rating 1–4). Nói "dịch" hoặc "quiz" để chuyển kiểu luyện.',
      async () => ({
        messages: [{ role: 'user', content: { type: 'text', text: CONVERSATION_SESSION } }],
      }),
    );

    // ---------------- Prompt: teach-back (the protégé effect) ----------------
    // The fourth practice type (2026-07-27). The learner EXPLAINS a pattern in Vietnamese instead of
    // using it, and the explanation is graded on the same FSRS path. Its own prompt (not a section of
    // Part A) because the loop genuinely differs: no sentence is composed, the marking scheme is the
    // enrichment card, and a good explanation feeds BACK into that card.
    server.prompt(
      'teach_back',
      'Bắt đầu buổi GIẢNG LẠI: Claude đưa một mẫu ngữ pháp và BẠN giảng lại bằng tiếng Việt (nghĩa, cách gắn, khi nào dùng, ví dụ của bạn) — Claude chấm phần giải thích đó (rating 1–4) và chỉ ra chỗ bạn còn thiếu. Giải thích được thì mới thật sự hiểu; lời giảng hay có thể lưu thẳng vào thẻ của mẫu.',
      async () => ({
        messages: [{ role: 'user', content: { type: 'text', text: TEACH_BACK_SESSION } }],
      }),
    );

    // ---------------- Prompt: import grammar patterns ----------------
    server.prompt(
      'import_grammar',
      'Nhập danh sách MẪU NGỮ PHÁP (dán từ Mazii/sổ tay/nguồn bất kỳ) vào kho học. (Từ vựng học bằng Anki, không nhập vào đây.)',
      async () => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                `The user will paste a list of GRAMMAR PATTERNS. Import it for them following this exact procedure. Everything you say to the user is in VIETNAMESE. (This app drills grammar only — every entry is grammar, do NOT sort anything into vocabulary.)\n` +
                `1. PARSE the list: split each entry into { expression (the pattern, e.g. 〜ばかりに), reading (kana/furigana — ALWAYS include it when the pattern contains kanji, so the table can show furigana above it), meaningVi, level, notes (how it attaches + usage caveats) }. ` +
                `If a meaning is not already Vietnamese, translate it into short Vietnamese. If the level is unclear, infer it from difficulty and say that you did.\n` +
                `2. SHOW A FULL PREVIEW TABLE for the user to approve (expression, reading, meaningVi, level, notes) and point out any entry you are unsure about. WAIT for their confirmation.\n` +
                `3. Once they agree: call add_grammar in batches (≤50 entries per call).\n` +
                `4. Report the outcome: how many patterns are new, which were skipped as duplicates; then call get_stats so they can see the library total.\n` +
                `Here is the list:\n`,
            },
          },
        ],
      }),
    );

    // ---------------- Prompt: story/dialogue mode ----------------
    server.prompt(
      'story_practice',
      'Luyện theo HỘI THOẠI/TRUYỆN NGẮN: dệt 6–8 item đến hạn vào một đoạn liền mạch, dịch từng câu.',
      async () => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                `Run DIALOGUE/SHORT-STORY translation practice for the user (one passage at a time, repeating until they stop). Everything you say to them is in VIETNAMESE.\n` +
                `1. Call get_due_items { maxItems: 8 } — use the composition sheet (NEVER show it to them) and the settings as usual.\n` +
                `2. Write ONE dialogue (2 speakers) or a 4–6 sentence short story in the given direction, weaving ALL items in naturally at the right register and difficulty, in a context DIFFERENT from the ones listed as already used. Give the passage a title and one line of scene-setting. Write the reference translation of the WHOLE passage FIRST (without showing it), then call stage_sentence { direction, sourceText = the whole source passage, suggested = the whole reference translation, exerciseType: "DIALOGUE", context = a context tag } → get a sentenceId. Do this BEFORE presenting the first sentence.\n` +
                `3. Present ONE SENTENCE AT A TIME in the shape "### Câu N": show the source sentence, they translate, you give SHORT feedback (1–2 lines, no rating yet), then move to the next.\n` +
                `4. End of passage: grade the WHOLE thing on the practice rubric (3 layers + a 1–4 rating per item, strict, when torn pick the lower one; rating ≤ 2 requires errorTags). Call submit_review ONCE for the passage: sentenceId (from step 2), userAnswer = their translations joined together, ratings for every item. Show the "Kết quả lượt này" block VERBATIM, then teach the single most memorable point.\n` +
                `5. Back to step 1 with a new passage.\n` +
                `The invariants are the same as the practice prompt (never reveal the answer early, never change a rating, furigana as 漢字（かんじ）).`,
            },
          },
        ],
      }),
    );

    // ---------------- Prompt: enrich the backlog ----------------
    server.prompt(
      'enrich_backlog',
      'Soạn thẻ enrichment cho MẪU NGỮ PHÁP và TỪ VỰNG còn thiếu — ngữ pháp: cách gắn, cụm, ví dụ, bẫy, phân biệt; từ vựng: cụm/khung câu, TỪ ĐỒNG NGHĨA + TRÁI NGHĨA, ví dụ có dịch. Câu luyện và lời giảng sẽ hay hơn hẳn.',
      async () => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text:
                `Enrich the user library with enrichment cards, following this procedure. Everything you say to them is in VIETNAMESE, and the card CONTENT is Vietnamese too (Japanese examples stay Japanese).\n` +
                // `quality: 'needs-work'`, NOT `enriched: false`. The old target list asked "is the column
                // null?", so a card that parses but carries nothing the tutor reads — or one stuck on an
                // older format — was counted as done forever and the sweep could never reach it. That is
                // the exact hole `quality` was added to close (lib/enrichment-quality.ts).
                `1. Ask which they want first, or do BOTH in order — the two libraries are separate and both have backlogs:\n` +
                `   - GRAMMAR: list_grammar { quality: "needs-work", limit: 20 }\n` +
                `   - VOCABULARY: list_vocab { quality: "needs-work", limit: 20 }\n` +
                `   Each row carries \`card: { tier, missing, v }\` — the tier (missing / broken / thin / outdated) and which dimensions are absent. READ THEM before writing anything:\n` +
                `   - \`missing\` / \`broken\` → write a whole card with enrich_items.\n` +
                `   - \`thin\` → the card exists and is worth keeping. patch_enrichment with EXACTLY what \`missing\` names. enrich_items here would overwrite content that is already good.\n` +
                `   - \`outdated\` with \`missing: []\` → nothing is absent; the card only lacks the CURRENT format stamp. Call patch_enrichment { itemId } with NO add and NO set: that re-stamps it and changes not one word of the content. Do NOT rewrite these — after a format bump the whole library reports \`outdated\` at once, and rewriting it would throw away every card the learner already has.\n` +
                `2. For each GRAMMAR pattern, write: structure (the ways it ATTACHES/CONJUGATES, e.g. "動詞辞書形 + 〜ばかりに", "名詞 + である + 〜ばかりに"), usage (one line on nuance / when it is used), ` +
                `collocations (3–6 Japanese phrases it genuinely occurs with), example + examples (short sentences, EACH with its Vietnamese translation in \`vi\` and \`jaRuby\` in 漢字[かな] markup so the app can show furigana and read it aloud), ` +
                `pitfalls (1–3 mistakes Vietnamese learners of Japanese typically make with it), contrasts (patterns it gets confused with + one line on the difference), ` +
                `register (only when it is worth noting).\n` +
                `3. For each VOCABULARY word, write: usage (what it means and WHEN it is reached for, not just a gloss — the word already has a meaningVi), collocations (≥2, ideally 4+, the frames it actually appears in: 約束[を]守る, 会議[に]出る), ` +
                `synonyms (near-synonyms as {term, reading, vi, note} — \`vi\` is REQUIRED because the learner cannot read a word they have not met, and \`note\` says how it differs), antonyms (same shape, ONLY if a real opposite exists — inventing one is worse than an empty list), ` +
                `2+ examples EACH with a Vietnamese translation, pitfalls (what a Vietnamese learner gets wrong: wrong collocation, confusing it with a near-synonym, wrong register), and structure only if the word class / transitivity pair is worth stating ("名詞 + する", "自動詞 開く / 他動詞 開ける").\n` +
                `4. CORRECT and SHORT beats exhaustive — if you are unsure of a field, leave it EMPTY rather than plausible. Set provenance { by: your model name, confidence, basedOn } honestly on every card.\n` +
                `5. SHOW A PREVIEW of the first 3 cards so they can approve the tone and depth. WAIT for confirmation before writing the rest.\n` +
                `6. Save in batches (enrich_items ≤20 cards per call; patch_enrichment is one item per call). Then report: how many were written vs patched, and how many rows still come back from list_grammar / list_vocab { quality: "needs-work" } — that count is the honest remaining backlog, and it is the number to repeat on.\n` +
                `Repeat whenever they say "tiếp".`,
            },
          },
        ],
      }),
    );
  },
  { serverInfo: { name: 'sakubun-mcp', version: '0.1.0' } },
  { basePath: '/api', disableSse: true },
);
