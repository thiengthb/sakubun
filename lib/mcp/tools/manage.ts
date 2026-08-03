import { z } from 'zod';
import { computeDossier, isEmptyDossier } from '@/lib/dossier';
import {
  contrastSchema,
  enrichmentSchema,
  exampleSchema,
  provenanceSchema,
} from '@/lib/enrichment';
import {
  getStats,
  getWeakReport,
  listItems,
  patchEnrichment,
  saveEnrichments,
  setBelowTargetSuspended,
  setItemSuspended,
  updateItem,
} from '@/lib/practice';
import { getLibraryHealth } from '@/lib/library-health';
import { getSessionRecap } from '@/lib/session-recap';
import {
  renderConsentGuard,
  renderDossier,
  renderLibraryHealth,
  renderStats,
  renderWeakReport,
} from '@/lib/mcp/render';
import {
  getUserId,
  guard,
  ID,
  LEVEL,
  mcpError,
  ok,
  okWithMarkdown,
  okWithNotes,
  type McpServer,
} from '@/lib/mcp/tool-kit';

export function registerManageTools(server: McpServer) {
  // ---------------- progress & management ----------------
  server.tool(
    'get_stats',
    'Progress overview (READ-ONLY) + a one-line library health check: total grammar library, patterns ' +
      'not yet learned, due now, ' +
      'reviewed/learned-new today, review count over the last 7 days, due forecast for the next 7 ' +
      'days, top leeches (frequently-wrong items). Use to open a study session or answer "how far ' +
      'along am I?". The block may end with ONE unnumbered clean-up suggestion — relay it as a yes/no ' +
      'question and WAIT; do NOT number it (the focus menu that follows owns the numbers), and never ' +
      'act on it unasked. For the full picture call get_library_health.\n' +
      'The JSON also carries `dossier` — a LEARNER MODEL derived from their own graded history ' +
      '(recurring confusions, patterns already solid, error trend) plus `dossier.notes`, a few dated ' +
      'observations YOU wrote in earlier sessions, each citing the sentences that support it. Use it ' +
      'to AIM the focus menu at something real instead of a generic list. It is for YOU: never recite ' +
      'it back unasked, and never state it as a fact about who they are — the derived numbers have ' +
      'minimum-evidence floors, the notes are your own past guesses. If they DO ask what you know ' +
      'about them, say it plainly and name the evidence so they can argue with it.',
    {},
    guard('get_stats', async (_args, extra: unknown) => {
      const userId = getUserId(extra);
      const now = new Date();
      // The health aggregate and the learner model both ride the call Claude ALREADY makes at session
      // open (the PUSH law), so neither needs a tool anyone has to remember. Composed HERE and not
      // inside `getStats`, because the web dashboard calls that too and must not pay for either scan.
      const stats = await getStats(userId, now);
      // Both ride the call Claude ALREADY makes at session open (the PUSH law); the recap needs the
      // learner's day-cutoff, which getStats has already loaded, so it goes second rather than
      // re-reading settings.
      const [health, dossier, recap] = await Promise.all([
        getLibraryHealth(userId, now),
        computeDossier(userId, now),
        getSessionRecap(userId, stats.settings.dayCutoffHour, now),
      ]);
      // The dossier stays OUT of the markdown: that block is `verbatim: true`, i.e. Vietnamese text
      // shown to the learner as-is, and the digest is Claude-facing English (the `verbatim` boundary
      // rule). Handing a learner a printout of their own error model is not a session opening. It
      // rides as a Claude-facing NOTE after the block instead — this is the ONLY place the digest is
      // rendered now (eval Scenario G, 2026-07-28: on the per-sentence composition sheet it changed
      // nothing across 6 trials and 2 deliberately different confusion pairs, so it moved here, where
      // it is read ONCE per session and its job — aim the focus menu — is what the description asks
      // for anyway).
      return okWithNotes(
        renderStats(stats, health, recap),
        { ...stats, library: health, dossier: isEmptyDossier(dossier) ? null : dossier },
        // renderStats relays at most ONE clean-up offer; it needs the same consent rule as the
        // other two proposal surfaces (apply a rule to EVERY surface, never just the one tested).
        [renderConsentGuard(health.suggestions), renderDossier(dossier)],
      );
    }),
  );

  server.tool(
    'get_weak_report',
    'WEAK-POINT report over the last 30 days (READ-ONLY): errors grouped by type ' +
      '(particle/conjugation/word-choice/…), most-missed items, leech list (forgotten over and over; ' +
      'lapses ≥ 8 come with a suspend suggestion). Includes a "Điểm yếu" markdown block — render it ' +
      'VERBATIM. Use when the user asks "where am I weak" or before a focused practice session.',
    {},
    guard('get_weak_report', async (_args, extra: unknown) => {
      const report = await getWeakReport(getUserId(extra));
      return okWithMarkdown(renderWeakReport(report), report);
    }),
  );

  server.tool(
    'list_grammar',
    'Search/filter the GRAMMAR library (READ-ONLY). Filters: level, search (matches ' +
      'expression/reading/meaning), suspended, enriched, limit (default 50). Use to verify after an ' +
      'import, check whether a pattern already exists, or list suspended patterns. Returns GRAMMAR ' +
      'ONLY — to look up VOCABULARY use list_vocab.',
    {
      level: LEVEL.optional(),
      search: z.string().optional(),
      suspended: z.boolean().optional(),
      enriched: z
        .boolean()
        .optional()
        .describe(
          'true = only items that already have an enrichment card; false = only items that do NOT (backlog)',
        ),
      quality: z
        .enum(['missing', 'broken', 'thin', 'outdated', 'ok', 'rich', 'needs-work'])
        .optional()
        .describe(
          'Filter by CARD QUALITY, which `enriched` cannot express (a one-line card counted as done ' +
            'forever). missing = no card · broken = unreadable, the tutor gets NOTHING · thin = parses ' +
            'but incomplete · outdated = complete on an older format · needs-work = any of those four. ' +
            'This is how you get the target list for a sweep.',
        ),
      limit: z.number().int().min(1).max(200).optional(),
    },
    guard('list_grammar', async (filter, extra: unknown) =>
      ok(await listItems(getUserId(extra), { ...filter, kind: 'GRAMMAR' })),
    ),
  );

  server.tool(
    'list_vocab',
    'Search/filter the VOCABULARY library (READ-ONLY). Filters: level, search (matches ' +
      'term/reading/meaning), suspended, limit (default 50). Use to check whether a word already ' +
      'exists, list suspended words, or before adding a Sino-Vietnamese reading/meaning. Returns ' +
      'VOCABULARY ONLY — to look up GRAMMAR use list_grammar.',
    {
      level: LEVEL.optional(),
      search: z.string().optional(),
      suspended: z.boolean().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
    guard('list_vocab', async (filter, extra: unknown) =>
      ok(await listItems(getUserId(extra), { ...filter, kind: 'VOCAB' })),
    ),
  );

  server.tool(
    'enrich_items',
    'SAVE an enrichment card (composed by YOU) for items — reference material for composing better ' +
      'sentences and introducing new items in more depth. Each card: structure (array of ≤6 ' +
      'ATTACHMENT/CONJUGATION FORMS of the pattern — e.g. "動詞辞書形 + 〜ばかりに", "な形容詞 + な + ' +
      '〜ばかりに", "名詞 + である + 〜ばかりに"; THIS is the structure/conjugation part, it should be ' +
      'present for every grammar pattern), usage (1 line of nuance/when to use it, in Vietnamese), ' +
      'collocations (≤8 ja phrases that commonly go with it), example {ja, vi, jaRuby} (ONE short ' +
      'canonical example) + examples ' +
      '(≤4 ADDITIONAL examples {ja, vi, jaRuby} for variety) — ALWAYS send jaRuby: the same ja ' +
      'sentence in 漢字[かな] markup (e.g. 一言[ひとこと]言[い]ったばかりに) so the app can show ' +
      'furigana and read it aloud in sync; omit it only for a sentence with no kanji, pitfalls ' +
      '(≤5 mistakes learners commonly make, in Vietnamese), contrasts (≤5 easily-confused entries + ' +
      'how they differ, in Vietnamese), ' +
      'register (formality nuance, if worth noting), provenance { by: your own model name, ' +
      'confidence: low|medium|high, basedOn: what you drew on } — the confidence is YOUR honest reading, ' +
      'and a low one is useful (it tells a later session, and anyone who forks this card, to check it). ' +
      'Quality over quantity — content must be ' +
      'CORRECT and concise. **OVERWRITES the whole existing card.** Use it to WRITE a card the item ' +
      'does not have yet, or to REPLACE one that is wrong/unparseable (read it with list_grammar ' +
      'first and send back the full corrected card). To ADD to a card that is already fine — one more ' +
      'example, pitfall, contrast — use patch_enrichment instead: it merges instead of overwriting.',
    {
      items: z
        .array(z.object({ itemId: ID, enrichment: enrichmentSchema }))
        .min(1)
        .max(20),
    },
    guard('enrich_items', async ({ items }, extra: unknown) =>
      ok(
        await saveEnrichments(
          getUserId(extra),
          items.map((i) => ({ itemId: i.itemId, enrichmentJson: JSON.stringify(i.enrichment) })),
        ),
      ),
    ),
  );

  server.tool(
    'get_library_health',
    'WHOLE-LIBRARY health check (READ-ONLY): size, the card-quality histogram, how many cards are ' +
      'stuck on an older format, per-level gaps at the levels being studied, how many patterns EASIER ' +
      'than the study target are still in the queue, measured retention vs target, kanji vocabulary ' +
      'missing its Sino-Vietnamese reading, and the biggest error-tag cluster. Ends with at most 2 ' +
      'ranked proposals carrying the exact tool + args. Use it when the learner asks how the library ' +
      'is doing / what to clean up, or ONCE at the start of a session — not every turn. Render the ' +
      'markdown block VERBATIM, then relay the numbered offers and WAIT for a yes.',
    {},
    guard('get_library_health', async (_args, extra: unknown) => {
      const result = await getLibraryHealth(getUserId(extra));
      return okWithNotes(renderLibraryHealth(result), result, [
        renderConsentGuard(result.suggestions),
      ]);
    }),
  );

  server.tool(
    'patch_enrichment',
    "MERGE new material into an item's enrichment card WITHOUT overwriting the rest of it. Use this " +
      '(not enrich_items) whenever the card already exists and you only want to ADD or fix a part: ' +
      'a contrast you just explained, a pitfall the learner just fell into, an extra example, the ' +
      'missing conjugation forms, a clearer usage line. `add` APPENDS (duplicates and overflow past ' +
      'the field cap are skipped and reported); `set` REPLACES usage/register/example (the old ' +
      'canonical example is kept as an extra). `fromSharedItemId` pulls the parts your card lacks ' +
      'from a public copy — it never takes their usage or canonical example. Refuses when the item ' +
      'has no readable card yet: write one with enrich_items first. Returns what landed, what was ' +
      'skipped, and the card tier + what is STILL missing afterwards. Restate `set.provenance` when your ' +
      'patch changes who stands behind the card.',
    {
      itemId: ID,
      add: z
        .object({
          structure: z.array(z.string().min(1)).optional(),
          collocations: z.array(z.string().min(1)).optional(),
          pitfalls: z.array(z.string().min(1)).optional(),
          contrasts: z.array(contrastSchema).optional(),
          examples: z.array(exampleSchema).optional(),
        })
        .optional(),
      set: z
        .object({
          usage: z.string().min(1).optional(),
          register: z.string().optional(),
          example: exampleSchema.optional(),
          provenance: provenanceSchema.optional(),
        })
        .optional(),
      fromSharedItemId: ID.optional(),
    },
    // No `.max()` on the add arrays on purpose: the merge enforces the schema caps and REPORTS the
    // overflow, which Claude can act on — a Zod rejection would arrive as a bare `too_big` (the same
    // reasoning as the stage_sentence runtime guard, plan step 0.4).
    guard('patch_enrichment', async (args, extra: unknown) => {
      const result = await patchEnrichment(getUserId(extra), args);
      if (result.patched) return ok(result);
      switch (result.reason) {
        case 'not-found':
          return mcpError('No such item (wrong or stale itemId). Call list_grammar / list_vocab.');
        case 'no-card':
          return mcpError(
            'This item has no readable enrichment card, so there is nothing to merge into. ' +
              'Compose the full card and send it with enrich_items instead.',
          );
        case 'donor-unusable':
          return mcpError(
            'That shared item cannot be used as a source: it is no longer public, its own card is ' +
              'unreadable, or it is a DIFFERENT pattern. Patch by hand with `add` / `set`.',
          );
        case 'nothing-to-add':
          return mcpError(
            'NOTHING was written: everything you sent is already on the card (or the arguments were ' +
              'empty). Read the card with check_library / list_grammar before offering to add to it.',
          );
        case 'conflict':
          return mcpError(
            'The card changed while you were composing this patch. Re-read it and send the patch again.',
          );
      }
    }),
  );

  // Shared body for the kind-specific content edits below. '' clears an optional column; undefined
  // leaves it unchanged. NEVER touches the FSRS schedule (updateItem only writes content columns).
  const emptyToNull = (v: string | undefined): string | null | undefined =>
    v === undefined ? undefined : v === '' ? null : v;
  const runContentUpdate = async (
    userId: string,
    itemId: string,
    patch: {
      expression?: string;
      reading?: string;
      hanviet?: string;
      meaningVi?: string;
      notes?: string;
      level?: string;
    },
  ) => {
    try {
      return ok(
        await updateItem(userId, itemId, {
          expression: patch.expression,
          reading: emptyToNull(patch.reading),
          hanviet: emptyToNull(patch.hanviet),
          meaningVi: patch.meaningVi,
          notes: emptyToNull(patch.notes),
          level: patch.level,
        }),
      );
    } catch (e) {
      if (e instanceof Error && 'code' in e && (e as { code?: string }).code === 'P2002') {
        return mcpError(
          'Another item already has this exact content (expression) — choose a different way to write it.',
        );
      }
      throw e;
    }
  };

  server.tool(
    'update_grammar',
    'EDIT the CONTENT of a GRAMMAR pattern — send only the fields you want to change (PATCH). ' +
      'Fields: expression (the pattern), reading (kana reading; "" to clear), meaningVi (Vietnamese ' +
      'meaning), notes (attachment/conjugation forms + usage notes; "" to clear), ' +
      'level (N5…N1). NEVER touches the FSRS schedule. To edit the enrichment CARD ' +
      '(structure/examples/pitfalls/…) use enrich_items instead. Get itemId from ' +
      'list_grammar/get_due_items/get_quiz_items. CALL WHEN the user ' +
      'says "sửa mẫu này…", "nghĩa mẫu này sai". (To edit VOCABULARY → use update_vocab.)',
    {
      itemId: ID,
      expression: z.string().min(1).optional().describe('The new pattern'),
      reading: z.string().optional().describe('Kana reading — "" to clear'),
      meaningVi: z.string().min(1).optional().describe('New Vietnamese meaning'),
      notes: z
        .string()
        .optional()
        .describe('Attachment/conjugation forms + usage notes — "" to clear'),
      level: LEVEL.optional().describe('JLPT level (N5…N1)'),
    },
    guard(
      'update_grammar',
      async ({ itemId, expression, reading, meaningVi, notes, level }, extra: unknown) =>
        runContentUpdate(getUserId(extra), itemId, {
          expression,
          reading,
          meaningVi,
          notes,
          level,
        }),
    ),
  );

  server.tool(
    'update_vocab',
    'EDIT the CONTENT of a VOCABULARY word — send only the fields you want to change (PATCH). ' +
      'Fields: expression (the word), reading (kana reading; "" to clear), sinoVietnamese ' +
      '(SINO-VIETNAMESE reading — you derive it yourself, very useful; "" to clear), ' +
      'meaningVi (Vietnamese meaning), notes (example/usage notes; "" to clear), level (N5…N1). NEVER ' +
      'touches the FSRS schedule. Get itemId from list_vocab. CALL WHEN the user says "sửa từ này…", ' +
      '"thêm/sửa âm Hán Việt cho từ này", "nghĩa từ này sai". (To edit GRAMMAR → use update_grammar.)',
    {
      itemId: ID,
      expression: z.string().min(1).optional().describe('The new word'),
      reading: z.string().optional().describe('Kana reading — "" to clear'),
      sinoVietnamese: z.string().optional().describe('Sino-Vietnamese reading — "" to clear'),
      meaningVi: z.string().min(1).optional().describe('New Vietnamese meaning'),
      notes: z.string().optional().describe('Example/usage notes — "" to clear'),
      level: LEVEL.optional().describe('JLPT level (N5…N1)'),
    },
    guard(
      'update_vocab',
      async (
        { itemId, expression, reading, sinoVietnamese, meaningVi, notes, level },
        extra: unknown,
      ) =>
        runContentUpdate(getUserId(extra), itemId, {
          expression,
          reading,
          hanviet: sinoVietnamese,
          meaningVi,
          notes,
          level,
        }),
    ),
  );

  server.tool(
    'set_item_suspended',
    'Suspend (suspended=true) or resume (false) a single item — a suspended item does not appear in ' +
      'practice but its history is kept intact. Get itemId from get_due_items/list_grammar/list_vocab.',
    { itemId: z.string().min(1), suspended: z.boolean() },
    guard('set_item_suspended', async ({ itemId, suspended }, extra: unknown) =>
      ok(await setItemSuspended(getUserId(extra), itemId, suspended)),
    ),
  );

  server.tool(
    'set_below_target_suspended',
    'Hide (suspended=true) or unhide (false) ALL grammar BELOW the level currently being studied ' +
      '(settings.grammarLevels) — so the user can fast-track up to their real level without ' +
      'already-known lower-level patterns crowding the review queue. "Below" = easier than the ' +
      'EASIEST level currently studied (studying [N3] → hides N4+N5; studying [N3,N4] → hides N5). ' +
      'Reversible, does NOT delete data (history is kept). Returns { affected, levels }. Suggested ' +
      'when the user says "thôi ôn N5", "tập trung N3", "học nhanh lên trình độ".',
    { suspended: z.boolean() },
    guard('set_below_target_suspended', async ({ suspended }, extra: unknown) =>
      ok(await setBelowTargetSuspended(getUserId(extra), suspended)),
    ),
  );
}
