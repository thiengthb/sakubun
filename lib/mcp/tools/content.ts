import { z } from 'zod';
import { MAX_IMPORT_CANDIDATES, previewImport } from '@/lib/import-preview';
import { addItems, GRAMMAR_KIND, VOCAB_CAPTURE_REASONS, VOCAB_KIND } from '@/lib/practice';
import { guard, LEVEL, ok, type McpServer } from '@/lib/mcp/tool-kit';

/** The two kinds an import candidate can be, as the tool surface names them. */
const IMPORT_KIND = z
  .enum([GRAMMAR_KIND, VOCAB_KIND])
  .describe('GRAMMAR for a pattern that gets scheduled and drilled · VOCAB for a single word.');

const grammarInputSchema = z.object({
  expression: z.string().min(1).describe('The grammar pattern, e.g. 〜ばかりに'),
  reading: z
    .string()
    .optional()
    .describe(
      'Kana/furigana reading of the pattern — send it ONLY when the pattern CONTAINS KANJI (so the ' +
        'Resources table can show furigana above it). NEVER send it for a pure-kana pattern ' +
        '(hiragana/katakana), where the reading would just repeat the pattern — the server drops it ' +
        'anyway when there is no kanji.',
    ),
  meaningVi: z.string().min(1).describe('Meaning, in Vietnamese'),
  level: LEVEL.optional(),
  notes: z.string().optional().describe('How it attaches (V-る + ばかりに…) plus usage notes'),
  tags: z.array(z.string()).optional(),
});

export function registerContentTools(server: McpServer) {
  // ---------------- content ----------------
  server.tool(
    'preview_import',
    'The learner PASTED real Japanese material — a work email, a chat log, a manga page, a mock-exam ' +
      'question, the text of a screenshot. Read it, pick out the grammar patterns and words actually ' +
      'worth studying, and call this BEFORE adding anything. DRY RUN — it writes NOTHING.\n' +
      'It answers the one question you cannot: which of these does the learner ALREADY have. Matching ' +
      'is on a normalised key, so 「〜わけにはいかない」 quoted in the source and わけにはいかない in their ' +
      'library are ONE pattern — never trust your own eyeballing of that, it is how duplicates get made.\n' +
      'Returns { new, duplicate, ambiguous, counts }. `new` = safe to add. `duplicate` = already theirs ' +
      '(and if `suspended` is true, do NOT add it — offer set_item_suspended { suspended: false }). ' +
      '`ambiguous` needs a DECISION, and the `reason` says which: "other-kind" = they own the same ' +
      'expression as the other kind · "repeated" = it appeared twice in the material.\n' +
      'Show the learner a SHORT Vietnamese summary (counts, then the names — never a wall of rows) and ' +
      'WAIT. On a yes, add ONLY what they agreed to, via add_grammar / add_vocab. ' +
      'Extract conservatively: a pattern they will actually be tested on, not every particle in the text.',
    {
      items: z
        .array(
          z.object({
            kind: IMPORT_KIND,
            expression: z
              .string()
              .min(1)
              .describe(
                'The pattern or word ALONE, as the material wrote it. Bare surface form — no 「」, no ' +
                  'parenthetical, no reason label.',
              ),
            reading: z.string().optional().describe('Kana reading — only when it contains kanji.'),
            meaningVi: z
              .string()
              .min(1)
              .describe(
                'Meaning in VIETNAMESE. Required even for the dry run: it is what the learner reads in ' +
                  'the preview to decide, and it is what add_grammar/add_vocab will need on a yes.',
              ),
            level: LEVEL.optional(),
            notes: z
              .string()
              .optional()
              .describe(
                'How it attaches + usage caveats, carried through to add_grammar on a yes.',
              ),
          }),
        )
        .min(1)
        .max(MAX_IMPORT_CANDIDATES),
    },
    guard('preview_import', async ({ items }, _extra: unknown) =>
      ok(await previewImport(items)),
    ),
  );

  server.tool(
    'add_grammar',
    'Bulk-add GRAMMAR patterns to the study library — this is the ONLY unit that gets scheduled for ' +
      'review (vocabulary is studied in Anki and is not imported here). Duplicates (already stored, or ' +
      'repeated within the list) are skipped and reported back. `notes` should record how the pattern ' +
      'attaches plus usage caveats, so later sentence composition stays accurate. `reading` (kana) ' +
      'SHOULD be present for every pattern containing kanji — the Resources table renders it as furigana ' +
      'above the pattern. Each pattern immediately gets a fresh FSRS schedule (introduced gradually per ' +
      'dailyNewGrammar). The meaning MUST be in Vietnamese.',
    { grammar: z.array(grammarInputSchema).min(1).max(100) },
    guard('add_grammar', async ({ grammar }, _extra: unknown) =>
      ok(await addItems(grammar)),
    ),
  );

  server.tool(
    'add_vocab',
    'Add VOCABULARY the user just looked up / did not know / used incorrectly to the SAKUBUN review ' +
      'library (not Anki) — so it can be woven back into later sentences and remembered IN CONTEXT ' +
      '(demand-driven: study exactly the words that are still weak). This is the MAIN vocabulary path ' +
      'now; add_vocab_to_anki is only an optional export. CALL IT WHEN: the user asks the meaning of a ' +
      'word they do not know, says "thêm từ này / mấy từ này", OR when YOU proactively spot a word worth ' +
      'learning and the user AGREES (see `reason`). Each word gets its own FSRS schedule (a separate ' +
      'budget from grammar — it never takes a grammar slot). Duplicates already in the vocab library are ' +
      'skipped and reported back. The meaning MUST be in Vietnamese.',
    {
      vocab: z
        .array(
          z.object({
            term: z
              .string()
              .min(1)
              .describe(
                'The word ALONE, written as it appears in the sentence (kanji/kana). BARE surface form ' +
                  'only: no 「」 or quotes around it, no parenthetical, and NEVER the reason label you ' +
                  'showed the user (e.g. send 言葉, not 「言葉」(chưa hiểu)) — the reason belongs in the ' +
                  '`reason` field and the reading in `reading`.',
              ),
            reading: z
              .string()
              .optional()
              .describe(
                'Kana reading (used to show furigana) — LEAVE EMPTY for a pure-kana word (no kanji)',
              ),
            sinoVietnamese: z
              .string()
              .optional()
              .describe(
                'SINO-VIETNAMESE reading of the kanji in this word — you derive it yourself (very useful for ' +
                  'Vietnamese learners); shown in the Vocabulary library. SEND it when the word has kanji; ' +
                  'leave empty for pure kana.',
              ),
            meaning: z.string().min(1).describe('Meaning, in Vietnamese'),
            example: z
              .string()
              .optional()
              .describe('Example sentence — prefer the one just practised (stored in notes)'),
            level: LEVEL.optional().describe('JLPT level as you judge it (leave empty if unsure)'),
            reason: z
              .enum(VOCAB_CAPTURE_REASONS)
              .optional()
              .describe(
                'WHY this word goes into the review inbox — set it only when YOU proactively flagged it: ' +
                  '"misused" = the user just USED IT WRONG · "unclear" = the user did NOT UNDERSTAND it ' +
                  'when they met it · "unknown" = a word at their level they have NEVER used (they may ' +
                  'not know it). Leave empty when the user simply looked the word up themselves.',
              ),
          }),
        )
        .min(1)
        .max(30),
    },
    guard('add_vocab', async ({ vocab }, _extra: unknown) =>
      ok(
        await addItems(
          vocab.map((v) => ({
            expression: v.term,
            reading: v.reading,
            hanviet: v.sinoVietnamese,
            meaningVi: v.meaning,
            notes: v.example,
            level: v.level,
            captureReason: v.reason,
          })),
          'LOOKUP',
          VOCAB_KIND,
        ),
      ),
    ),
  );

  // NOTE: add_vocab_to_anki (AnkiConnect push) was removed 2026-07-23. It ran server-side and could
  // only reach the Anki on the container's HOST, so on a multi-user deploy it never hit the member's
  // own Anki. Vocabulary now leaves via a downloadable .apkg — Settings -> Dữ liệu -> "Tải bộ thẻ
  // Anki" (app/api/export/anki), built by lib/anki-apkg.ts.
}
