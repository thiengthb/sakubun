import { z } from 'zod';
import { computeDossier, isEmptyDossier } from '@/lib/session/dossier';
import {
  contrastSchema,
  enrichmentSchema,
  exampleSchema,
  provenanceSchema,
  relatedSchema,
} from '@/lib/library/enrichment';
import {
  getStats,
  getWeakReport,
  listCalibrationProposals,
  listItems,
  patchEnrichment,
  saveEnrichments,
  setBelowTargetSuspended,
  setItemSuspended,
  setProposalVerdict,
  updateItem,
} from '@/lib/library/practice';
import { getLibraryHealth } from '@/lib/library/health';
import { getSessionRecap } from '@/lib/session/recap';
import {
  renderConsentGuard,
  renderDossier,
  renderLibraryHealth,
  renderStats,
  renderWeakReport,
} from '@/lib/mcp/render';
import {
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
    guard('get_stats', async (_args, _extra: unknown) => {
      const now = new Date();
      const stats = await getStats(now);
      const [health, dossier, recap] = await Promise.all([
        getLibraryHealth(now),
        computeDossier(now),
        getSessionRecap(stats.settings.dayCutoffHour, now),
      ]);
      return okWithNotes(
        renderStats(stats, health, recap),
        { ...stats, library: health, dossier: isEmptyDossier(dossier) ? null : dossier },
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
    guard('get_weak_report', async (_args, _extra: unknown) => {
      const report = await getWeakReport();
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
    guard('list_grammar', async (filter, _extra: unknown) =>
      ok(await listItems({ ...filter, kind: 'GRAMMAR' })),
    ),
  );

  server.tool(
    'list_vocab',
    'Search/filter the VOCABULARY library (READ-ONLY). Filters: level, search (matches ' +
      'term/reading/meaning), suspended, enriched, quality, limit (default 50). Use to check whether a ' +
      'word already exists, list suspended words, get the target list for an enrichment sweep, or ' +
      'before adding a Sino-Vietnamese reading/meaning. Returns ' +
      'VOCABULARY ONLY — to look up GRAMMAR use list_grammar.',
    {
      level: LEVEL.optional(),
      search: z.string().optional(),
      suspended: z.boolean().optional(),
      enriched: z
        .boolean()
        .optional()
        .describe(
          'true = only words that already have an enrichment card; false = only words that do NOT',
        ),
      quality: z
        .enum(['missing', 'broken', 'thin', 'outdated', 'ok', 'rich', 'needs-work'])
        .optional()
        .describe(
          'Filter by CARD QUALITY, which `enriched` cannot express (a one-line card counted as done ' +
            'forever). missing = no card · broken = unreadable, the tutor gets NOTHING · thin = parses ' +
            'but incomplete (for a word: no collocations, or no synonym/antonym, or fewer than 2 ' +
            'examples with a Vietnamese translation) · outdated = complete on an older format · ' +
            'needs-work = any of those four. This is how you get the target list for a vocab sweep.',
        ),
      limit: z.number().int().min(1).max(200).optional(),
    },
    guard('list_vocab', async (filter, _extra: unknown) =>
      ok(await listItems({ ...filter, kind: 'VOCAB' })),
    ),
  );

  server.tool(
    'enrich_items',
    'SAVE an enrichment card (composed by YOU) - reference material for composing better sentences ' +
      'and introducing items in depth. GRAMMAR and VOCABULARY owe DIFFERENT fields; each is scored ' +
      'against its own bar.\n' +
      'BOTH: usage (nuance / when to reach for it, Vietnamese, 25+ chars - an explanation, not a ' +
      'label); example + examples (≤4 more). EVERY example needs `vi`, a real Vietnamese translation ' +
      'of that sentence - untranslated Japanese is unusable and scores as incomplete - plus `jaRuby`, ' +
      'the same sentence in 漢字[かな] markup (一言[ひとこと]言[い]った...) for furigana + audio; omit ' +
      'jaRuby only if there is no kanji. pitfalls (≤5, what Vietnamese learners get wrong). register ' +
      'if worth noting. provenance { by: your model name, confidence, basedOn } - an honest `low` is ' +
      'useful.\n' +
      'GRAMMAR: structure (≤6 ATTACHMENT/CONJUGATION forms - "動詞辞書形 + 〜ばかりに", ' +
      '"名詞 + である + 〜ばかりに"); collocations (≤8); contrasts (≤5 confusable PATTERNS + the ' +
      'difference).\n' +
      'VOCABULARY: collocations (≥2, ideally 4+ - the real frames 約束を守る, 会議に出る; this is what ' +
      'stops correct-but-unnatural Japanese); synonyms (≤6 as {term, reading, vi, note} - `vi` is ' +
      'REQUIRED, the learner cannot read a word they have not met, `note` = how it differs); antonyms ' +
      '(≤4, same shape) ONLY if a real opposite exists - never invent one, [] is a correct answer; ' +
      'optionally structure for word class / frame ("名詞 + する", "自動詞 開く / 他動詞 開ける"). At ' +
      'least ONE synonym or antonym is required for completeness.\n' +
      'CORRECT and concise beats exhaustive; leave a field empty rather than guess. **OVERWRITES the ' +
      'whole card** - use it for an item with no card, or to REPLACE a wrong/unparseable one (read it ' +
      'with list_grammar / list_vocab first, send the full corrected card). To ADD to a card that is ' +
      'already fine, use patch_enrichment: it merges.',
    {
      items: z
        .array(z.object({ itemId: ID, enrichment: enrichmentSchema }))
        .min(1)
        .max(20),
    },
    guard('enrich_items', async ({ items }, _extra: unknown) =>
      ok(
        await saveEnrichments(
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
    guard('get_library_health', async (_args, _extra: unknown) => {
      const result = await getLibraryHealth();
      return okWithNotes(renderLibraryHealth(result), result, [
        renderConsentGuard(result.suggestions),
      ]);
    }),
  );

  server.tool(
    'patch_enrichment',
    "MERGE new material into an item's enrichment card WITHOUT overwriting the rest of it. Use this " +
      '(not enrich_items) whenever the card already exists and you only want to ADD or fix a part: ' +
      'a contrast you just explained, a pitfall the learner just fell into, an extra example, a ' +
      'synonym/antonym for a word, the missing conjugation forms, a clearer usage line. ' +
      '`add` APPENDS (duplicates and overflow past ' +
      'the field cap are skipped and reported); `set` REPLACES usage/register/example (the old ' +
      'canonical example is kept as an extra). Refuses when the item ' +
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
          synonyms: z.array(relatedSchema).optional(),
          antonyms: z.array(relatedSchema).optional(),
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
    },
    guard('patch_enrichment', async (args, _extra: unknown) => {
      const result = await patchEnrichment(args);
      if (result.patched) return ok(result);
      switch (result.reason) {
        case 'not-found':
          return mcpError('No such item (wrong or stale itemId). Call list_grammar / list_vocab.');
        case 'no-card':
          return mcpError(
            'This item has no readable enrichment card, so there is nothing to merge into. ' +
              'Compose the full card and send it with enrich_items instead.',
          );
        case 'nothing-to-add':
          return mcpError(
            'NOTHING was written: everything you sent is already on the card, AND the card was already ' +
              'stamped with the current format (an empty patch on a complete OLDER-format card is not a ' +
              'no-op — it re-stamps it). Read the card with check_library / list_grammar before ' +
              'offering to add to it.',
          );
        case 'conflict':
          return mcpError(
            'The card changed while you were composing this patch. Re-read it and send the patch again.',
          );
      }
    }),
  );

  const emptyToNull = (v: string | undefined): string | null | undefined =>
    v === undefined ? undefined : v === '' ? null : v;
  const runContentUpdate = async (
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
        await updateItem(itemId, {
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
      async ({ itemId, expression, reading, meaningVi, notes, level }, _extra: unknown) =>
        runContentUpdate(itemId, {
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
        _extra: unknown,
      ) =>
        runContentUpdate(itemId, {
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
    guard('set_item_suspended', async ({ itemId, suspended }, _extra: unknown) =>
      ok(await setItemSuspended(itemId, suspended)),
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
    guard('set_below_target_suspended', async ({ suspended }, _extra: unknown) =>
      ok(await setBelowTargetSuspended(suspended)),
    ),
  );

  server.tool(
    'list_calibration_proposals',
    'READ-ONLY. The calibration controller runs in SHADOW mode: after a graded turn it may record ' +
      "what it WOULD have changed about the learner's settings (difficulty / sentence size / " +
      'scaffolding rung) and why, without changing anything. This lists those proposals, newest ' +
      'first, each with `verdict` = null (not reviewed yet) | "agree" | "disagree".\n' +
      'Use it when the learner asks whether the app is reading their level right, or when you want ' +
      'to review a batch WITH them: read out the unreviewed ones in their own words (the `reason` ' +
      'field is already learner-facing Vietnamese), ask whether each one felt right, then record the ' +
      'answer with set_proposal_verdict. Never change a setting off the back of a proposal on your ' +
      'own — the whole point of shadow mode is that a human answers first.',
    { limit: z.number().int().min(1).max(200).optional() },
    guard('list_calibration_proposals', async ({ limit }, _extra: unknown) => {
      const rows = await listCalibrationProposals(limit ?? 50);
      const unreviewed = rows.filter((r) => r.verdict === null).length;
      return ok({ total: rows.length, unreviewed, proposals: rows });
    }),
  );

  server.tool(
    'set_proposal_verdict',
    'Record the learner\'s answer to ONE shadow proposal: "agree" (the app read them right) or ' +
      '"disagree" (it did not). Get `id` from list_calibration_proposals. This is the ONLY thing ' +
      'that turns "we talked about it" into evidence — ask the learner, then record what THEY said, ' +
      'never your own opinion. Returns { updated } — false means the id is unknown.',
    { id: ID, verdict: z.enum(['agree', 'disagree']) },
    guard('set_proposal_verdict', async ({ id, verdict }, _extra: unknown) =>
      ok({ updated: await setProposalVerdict(id, verdict) }),
    ),
  );
}
