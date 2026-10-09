import { z } from 'zod';
import {
  MAX_ASSERTED_NOTES,
  MAX_NOTE_CHARS,
  MAX_NOTE_EVIDENCE,
  MIN_NOTE_CHARS,
  NOTE_TTL_DAYS,
} from '@/lib/learner-notes';
import { errorDetailSchema } from '@/lib/error-tags';
import { getDueBatch, stageSentence, submitReview } from '@/lib/practice';
import { classifyExtraPatterns, drilledLevelOf, MAX_EXTRA_PATTERNS } from '@/lib/scaffolding';
import { QUIZ_DISTRACTOR_COUNT } from '@/lib/quiz-options';
import {
  renderCalibrationShadow,
  renderDueBatch,
  renderGradeResult,
  renderQuizOptions,
  renderScaffold,
  renderTeachBackHarvest,
} from '@/lib/mcp/render';
import {
  DIRECTION,
  ERROR_TAG,
  EXERCISE_TYPE,
  guard,
  ID,
  LEVEL,
  mcpError,
  okWithMarkdown,
  okWithNotes,
  RATING,
  ROLE,
  type McpServer,
} from '@/lib/mcp/tool-kit';

const COMPOSE_NOTE =
  'Compose strictly per the returned `settings`: direction (JA_VI = give a Japanese sentence, they ' +
  'translate to Vietnamese; VI_JA = give a Vietnamese sentence, they translate to Japanese), ' +
  'sentenceSize (sets BOTH the source character count AND how many grammar patterns to weave in — the ' +
  'exact numbers are on the composition sheet), difficulty (1–5), register, translationStyle, topics, ' +
  'levels. You MUST use ALL the batch patterns naturally; the vocabulary is yours to pick, at ' +
  'settings.vocabCeiling. NEVER reveal the answer before the user has replied.';

export function registerPracticeTools(server: McpServer) {
  server.tool(
    'get_due_items',
    '(For TRANSLATION practice. For fill-in-the-blank QUIZ practice do NOT use this tool — use ' +
      'get_quiz_items.) Fetch the batch of grammar patterns for the NEXT practice sentence. The server ' +
      'has already picked them per FSRS + settings: due patterns first, then new ones within the daily ' +
      'limit; TARGET = the focus of the sentence, SECONDARY = woven in alongside. Returns ' +
      '{ direction, mode, items[{itemId, expression, reading, meaningVi, level, notes, role, isNew}], ' +
      'limits, settings, today, dueNow, newAvailable, newBeyondLevels, nextDueAt }. mode="MASTERY" (the ' +
      'composition sheet opens with the MASTERY MODE banner): the queue is clear but mastered patterns remain — compose a ' +
      'sentence that RECOMBINES them, harder/longer, and introduce NO new pattern (details on the sheet). ' +
      'mode="ACQUIRE" = the normal loop. Empty items + a near nextDueAt (minutes away — a learning step) ' +
      '→ suggest a short break, then call again; nextDueAt far away or null → done for today (check ' +
      'limits to see which cap was hit). Empty items BUT newBeyondLevels > 0 → NOT done: unlearned NEW ' +
      'patterns remain at levels outside settings.grammarLevels — tell the user and suggest widening them ' +
      '(update_settings) or importing grammar at the level they study. isNew=true → first time seeing ' +
      'this item: INTRODUCE its meaning + usage before setting the exercise. `maxItems` (1–12) is ONLY ' +
      'for dialogue/story mode (the story_practice prompt), to gather several items at once. FOCUSED ' +
      'PRACTICE: when the user wants a specific level or pattern, pass focusLevels and/or focusPatterns ' +
      '— the server prioritises exactly those (including ones NOT yet due = early review, or new ones ' +
      'outside settings.grammarLevels), and tops up with other patterns per FSRS when the sentence length needs ' +
      'more (marked "filler" on the composition sheet). focus.matched=0 → the request matched nothing in ' +
      'the library; tell the user. WEAK-SPOT DRILL: pass focusWeak=true → the server itself picks the ' +
      'patterns the user often gets wrong (rating ≤ 2 within 30 days) + leeches as the focus (no need ' +
      'for focusLevels/Patterns); focus.matched=0 means there is no weakness data yet → tell the user ' +
      'and practise randomly. ' +
      COMPOSE_NOTE,
    {
      maxItems: z.number().int().min(1).max(12).optional(),
      focusLevels: z
        .array(LEVEL)
        .max(5)
        .optional()
        .describe('Focus by LEVEL — pass it only when the user asks, e.g. "luyện N3"'),
      focusPatterns: z
        .array(z.string().min(1))
        .max(10)
        .optional()
        .describe(
          'Focus on specific PATTERNS — substring match against expression/reading/meaning, e.g. ["わけにはいかない"]',
        ),
      focusWeak: z
        .boolean()
        .optional()
        .describe(
          'WEAK-SPOT DRILL — the server ITSELF picks the patterns the user OFTEN gets wrong (rating ≤ 2 ' +
            'within 30 days) plus leeches, and prioritises them (including ones not yet due = early ' +
            'review). Turn it on when the user picks "luyện điểm yếu" from the opening menu; no need ' +
            'to pass focusLevels/focusPatterns.',
        ),
      groupId: z
        .string()
        .min(1)
        .optional()
        .describe(
          'STUDY-GROUP focus — scope the sentence to the GRAMMAR items in this group (get the id from ' +
            'list_groups). Turn it on when the user says "luyện nhóm X". focus.matched=0 → the group ' +
            'has no schedulable grammar in it yet; tell the user.',
        ),
      exerciseType: EXERCISE_TYPE.optional().describe(
        'WHAT YOU ARE ABOUT TO BUILD with this batch. Send it whenever you are NOT composing an ordinary ' +
          'translation sentence — "TEACH_BACK" or "CONVERSATION" — and the composition sheet drops or ' +
          'corrects the lines that do not apply to that mode. Without it the sheet keeps its full ' +
          'sentence-composing form, which CONTRADICTS those two protocols rather than merely being ' +
          'noise: it would tell you `REQUIRED: pass suggestedRuby` on a teach-back turn (that protocol ' +
          'forbids it) and name a direction the protocol does not stage. Omit it for normal translation ' +
          'practice and for the scaffolded rungs — the full sheet is correct there.',
      ),
    },
    guard(
      'get_due_items',
      async (
        { maxItems, focusLevels, focusPatterns, focusWeak, groupId, exerciseType },
        _extra: unknown,
      ) => {
        const focus =
          focusLevels?.length || focusPatterns?.length || focusWeak || groupId
            ? {
                levels: focusLevels,
                patterns: focusPatterns,
                weak: focusWeak || undefined,
                groupId,
              }
            : undefined;
        const now = new Date();
        const batch = await getDueBatch(now, maxItems, focus, exerciseType);
        return okWithMarkdown(renderDueBatch(batch), batch, {
          verbatim: false,
        });
      },
    ),
  );

  server.tool(
    'stage_sentence',
    'RECORD the exercise sentence + your reference translation (suggested) FIRST — call this straight ' +
      'after composing, BEFORE showing anything to the user. This is the anti-contamination checkpoint: ' +
      'submit_review reuses exactly the reference translation SAVED here, so it can never be dragged ' +
      'along by what the user wrote. Returns { sentenceId } — pass that exact string to submit_review. ' +
      '(Per-parameter detail: see the field descriptions below.)',
    {
      direction: DIRECTION,
      sourceText: z
        .string()
        .min(1)
        .describe(
          'The exercise sentence you just composed (in the source language, per direction)',
        ),
      suggested: z
        .string()
        .min(1)
        .describe('YOUR reference translation — written NOW, BEFORE seeing what the user wrote'),
      context: z
        .string()
        .max(120)
        .optional()
        .describe(
          'A 2–4 word context tag in Vietnamese, e.g. "gọi món ở quán" — used to avoid repeating contexts',
        ),
      exerciseType: EXERCISE_TYPE.optional().describe(
        'Exercise type for this sentence, UPPERCASE (default TRANSLATION)',
      ),
      items: z
        .array(z.object({ itemId: ID, role: ROLE }))
        .optional()
        .describe(
          'REQUIRED: the grammar patterns in the batch (itemId + role exactly as get_due_items returned ' +
            'them). Without it the sentence CANNOT be rated — no FSRS write, no review scheduled — so ' +
            'staging is rejected. Send every entry the batch listed, VOCAB ones included.',
        ),
      sourceRuby: z
        .string()
        .optional()
        .describe(
          'ONLY when direction=JA_VI: the exercise sentence itself rewritten as 漢字[かな] (each kanji ' +
            'cluster followed by its reading in square brackets, e.g. "彼[かれ]は忙[いそが]しい") — so the ' +
            'history card shows furigana on hover. Leave empty when the sentence is Vietnamese.',
        ),
      extraPatterns: z
        .array(z.string().min(1))
        .max(MAX_EXTRA_PATTERNS)
        .optional()
        .describe(
          'DECLARE the grammar you knowingly used BEYOND the scheduled items — the scaffolding the ' +
            'protocol lets you weave in "not graded, not listed". Short surface forms, as you would ' +
            'write the pattern (〜ておく, 〜ながら), never a whole clause. The server checks each one ' +
            'against this learner library and answers known / new-to-them / published-by-someone-else, ' +
            'so a structure they have NEVER met cannot teach itself unannounced inside an exercise ' +
            'about something else, and "never scaffold ABOVE the level being drilled" becomes ' +
            'checkable instead of aspirational. Omit it when the sentence used nothing beyond the batch.',
        ),
      quiz: z
        .object({
          correct: z.string().min(1).describe('The TARGET pattern — the one right answer.'),
          distractors: z
            .array(z.string().min(1))
            .length(QUIZ_DISTRACTOR_COUNT)
            .describe(
              'Exactly 3 WRONG patterns. Each must be genuinely confusable with the target (near ' +
                'meaning or near form) yet wrong IN THIS SENTENCE for a reason you can state in one ' +
                'clause. Never a politeness or conjugation variant of the target, and never a second ' +
                'option that also fits — a blank with two acceptable answers is an unanswerable question.',
            ),
        })
        .optional()
        .describe(
          'QUIZ turns ONLY. Send the four options as DATA and the server lays them out into A-D ' +
            'itself, returning the exact option line to display. Do NOT choose the answer letter — ' +
            'that placement is not yours to make (models park the answer on one letter, which makes ' +
            'the quiz guessable). The server also refuses a set with duplicate options before the ' +
            'learner ever sees it.',
        ),
      suggestedRuby: z
        .string()
        .optional()
        .describe(
          'ONLY when direction=VI_JA: the reference translation (suggested) rewritten as 漢字[かな] (each ' +
            'kanji cluster followed by its reading in square brackets) — so the Japanese answer in ' +
            'history shows furigana on hover. Leave empty when the answer is Vietnamese.',
        ),
    },
    guard('stage_sentence', async (args, _extra: unknown) => {
      if (!args.items?.length) {
        return mcpError(
          'Missing items — nothing was staged. A sentence with no items cannot be rated (no FSRS ' +
            'write, no review scheduled), so this call is refused rather than losing the turn.\n' +
            'RECOVERY: call stage_sentence AGAIN with the SAME direction / sourceText / suggested, ' +
            'plus items = the { itemId, role } list of EVERY entry get_due_items returned for this ' +
            'sentence (copy the itemIds verbatim; include role="VOCAB" entries). If you no longer ' +
            'hold that batch, call get_due_items again and compose from the batch it returns.',
        );
      }
      if (args.exerciseType === 'QUIZ' && !args.quiz) {
        return mcpError(
          'Missing quiz — a QUIZ turn must send its four options as DATA so the SERVER places the ' +
            'correct answer. Refused rather than staged, because a question whose options are not ' +
            'recorded cannot be audited or re-rendered, and its answer position would be yours to ' +
            'pick (which is exactly what drifts).\n' +
            'RECOVERY: call stage_sentence AGAIN with the SAME direction / sourceText / suggested / ' +
            'items, plus quiz = { correct: "<the target pattern>", distractors: ["<3 different, ' +
            'genuinely confusable patterns>"] }. Put ONLY the sentence with (＿＿) in sourceText — do ' +
            'NOT write the A-D options yourself; the server appends them and hands you back the line ' +
            'to display.',
        );
      }
      const { sentenceId, quiz } = await stageSentence(args);
      const scaffold = args.extraPatterns?.length
        ? await classifyExtraPatterns(
            args.extraPatterns,
            await drilledLevelOf(
              args.items.map((i) => i.itemId),
            ),
          )
        : [];
      const text =
        `Sentence and reference translation recorded. sentenceId = "${sentenceId}"\n` +
        `Once you have graded, call submit_review with THIS EXACT sentenceId (copy ` +
        `"${sentenceId}" verbatim) — NEVER invent another id (e.g. "pending", "manual", ` +
        `"pending-manual-review"). If you do not hold a sentenceId from stage_sentence for this ` +
        `sentence, it was never staged — call stage_sentence first, do not fabricate an id.\n\n` +
        '```json\n' +
        JSON.stringify({ sentenceId, scaffold }) +
        '\n```';
      const notes = [renderQuizOptions(quiz), renderScaffold(scaffold)].filter(Boolean);
      return {
        content: [{ type: 'text' as const, text: [text, ...notes].join('\n\n') }],
      };
    }),
  );

  server.tool(
    'submit_review',
    'RECORD the result of a sentence AFTER the user has answered and you have graded it — the ONLY ' +
      'tool that writes the FSRS schedule. The sentence and reference translation were already saved by ' +
      'stage_sentence; here you pass sentenceId (from stage_sentence), userAnswer, and ' +
      'ratings[{itemId, rating, role}] for EVERY item on the Anki rubric: 1 Again · 2 Hard · 3 Good · ' +
      '4 Easy — WHEN TORN, PICK THE LOWER ONE; rating ≤ 2 must carry errorTags. Ratings are final (a ' +
      'second call for an already-graded sentence is rejected). (Per-parameter detail: see the field ' +
      'descriptions below.)',
    {
      sentenceId: z
        .string()
        .optional()
        .describe(
          'The EXACT sentenceId stage_sentence returned for this sentence (copied verbatim) — never invent ' +
            'one. No id in hand means stage_sentence was never called: stage first, then submit.',
        ),
      userAnswer: z.string().min(1),
      feedback: z.string().optional(),
      score: z
        .number()
        .int()
        .min(0)
        .max(100)
        .describe(
          'Overall impression of the answer, 0-100. REQUIRED: the learner reads this number as "was I ' +
            'graded at all", so a turn cannot be recorded without it. Send your honest score even when ' +
            'the ratings already say it.',
        ),
      ratings: z
        .array(
          z.object({
            itemId: ID,
            rating: RATING,
            role: ROLE.optional(),
            errorTags: z
              .array(ERROR_TAG)
              .max(4)
              .optional()
              .describe(
                'REQUIRED when rating ≤ 2: the error type — particle | conjugation | word-choice | ' +
                  'word-order | register | comprehension | kana-spelling | omission',
              ),
            errorDetail: errorDetailSchema
              .optional()
              .describe(
                'The CONFUSION PAIR behind the tag, when you can name one: [{ used: what they actually ' +
                  'wrote, required: what the sentence needed, tag?: which tag it explains }]. Send it ' +
                  'WHENEVER the mistake was reaching for the WRONG FORM/WORD (ほかに instead of 〜どころか, ' +
                  'に instead of で) — that is the version of the error the app can teach against later; ' +
                  '"word-choice" alone is not. Omit it when there is nothing to pair (a dropped particle, ' +
                  'a botched conjugation, an omission). Short surface forms, not explanations.',
              ),
          }),
        )
        .min(1)
        .max(10),
      assists: z
        .number()
        .int()
        .min(0)
        .max(20)
        .optional()
        .describe(
          'How many times you HELPED before the learner answered this turn: a hint given, or them ' +
            'asking what a word/structure means. Report it honestly — the server uses it (with how ' +
            'long the answer took) to decide whether a claimed "4 Easy" is really Easy, and an answer ' +
            'that needed help is Good at best. 0 or omitted = they answered unaided.',
        ),
      learnerNote: z
        .object({
          text: z
            .string()
            .min(MIN_NOTE_CHARS)
            .max(MAX_NOTE_CHARS)
            .describe(
              'ONE sentence IN VIETNAMESE about the LEARNER, not about this answer — a durable ' +
                'pattern you could not derive from counters: how they self-correct, what kind of ' +
                'prompt unblocks them, a habit from their L1. Vietnamese because THEY SEE IT on their ' +
                'dashboard and may disagree, so write it as something you would say to their face. ' +
                'Never a score, never a restatement of the ratings.',
            ),
          evidence: z
            .array(ID)
            .min(1)
            .max(MAX_NOTE_EVIDENCE)
            .describe(
              'sentenceIds backing the claim — include THIS sentenceId. Ids that are not theirs are ' +
                'rejected: the whole point is that they can re-read the evidence and argue back.',
            ),
        })
        .optional()
        .describe(
          'OPTIONAL, and rare — send one only when you noticed something about this learner that the ' +
            'app cannot count for itself. RARE IS NOT NEVER: eval Scenario K (2026-07-28) drove six ' +
            'real graded turns, INCLUDING one built to trigger this, and got zero notes — a field ' +
            'described only by what it is not never gets sent. So here is what DOES qualify, and if a ' +
            'turn shows one of these, SEND IT: (a) they talked themselves OUT of an answer that was ' +
            'already right — the transcript, not the rating, is the evidence; (b) a specific kind of ' +
            'hint visibly unblocked them where a different kind had not; (c) a habit that reads as ' +
            'their L1 showing through, across more than this one sentence. Anything you could compute ' +
            'from ratings, scores or counters is NOT one of these — the app already has it. Still send ' +
            'nothing on an ordinary turn, which is most turns. At most ' +
            String(MAX_ASSERTED_NOTES) +
            ' are kept; a new one EVICTS the oldest, each expires after ' +
            String(NOTE_TTL_DAYS) +
            ' days, and re-sending the same observation just renews it. The result tells you what ' +
            'happened to it.',
        ),
    },
    guard('submit_review', async (args, _extra: unknown) => {
      const sentenceId = args.sentenceId?.trim();
      if (!sentenceId) {
        return mcpError(
          'Missing sentenceId — this sentence was never staged, so nothing was written to the review ' +
            'schedule.\nRECOVER NOW (you do not lose the turn): call stage_sentence { direction, sourceText = ' +
            'the EXACT sentence you just showed, suggested = your reference translation, items = the ' +
            '{ itemId, role } list of EVERY pattern this sentence drilled (REQUIRED — without it the ' +
            'sentence cannot be rated, and this recovery would reproduce the very problem) } → get a ' +
            'sentenceId → CALL submit_review AGAIN with that exact sentenceId plus userAnswer and the ' +
            'full ratings.\n' +
            'NEVER invent an id ("pending"/"manual"). From the next turn on: EVERY sentence must be staged ' +
            'BEFORE it is shown.',
        );
      }
      const result = await submitReview({
        ...args,
        sentenceId,
        ratings: args.ratings.map((r) => ({ ...r, rating: r.rating as 1 | 2 | 3 | 4 })),
      });
      return okWithNotes(renderGradeResult(result), result, [
        renderCalibrationShadow(result.calibration),
        renderTeachBackHarvest(result.teachBack),
      ]);
    }),
  );
}
