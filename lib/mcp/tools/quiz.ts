import { z } from 'zod';
import { getQuizBatch, skipSentence } from '@/lib/practice';
import { getUserId, guard, ID, ok, type McpServer } from '@/lib/mcp/tool-kit';

export function registerQuizTools(server: McpServer) {
  // ---------------- quiz ----------------
  server.tool(
    'get_quiz_items',
    'Fetch ONE due GRAMMAR pattern to be the CORRECT answer of ONE multiple-choice quiz question A–D ' +
      '(used with the `quiz` prompt). count=1 by default (one target pattern / one question). Returns ' +
      '{ kind, count, items[{ itemId, expression, reading, meaningVi, notes, level, enrichment ' +
      '(structure/examples/pitfalls/CONTRASTS — use enrichment.contrasts to build the 3 confusable ' +
      'DISTRACTORS, compose the sentence and explain it), isNew ], contrastCandidates, ' +
      'sameLevelCandidates }. **Build the 3 distractors from `contrastCandidates`** — real patterns ' +
      "from this learner's library that are confusable with the target (its own contrasts PLUS every " +
      'card that names it as a contrast, a reverse link no single card holds). `sameLevelCandidates` ' +
      'is a weaker top-up; inventing a pattern from memory is the last resort and is where option sets ' +
      'with no single correct answer come from (cards average 1.6 contrasts against the 3 a question ' +
      'needs). Cannot assemble 3 genuinely confusable ones? Choose a DIFFERENT target pattern rather ' +
      'than ship a bad question. You do NOT choose where the correct ' +
      'answer sits: send the target + 3 distractors to stage_sentence as `quiz` (REQUIRED — the call ' +
      'is refused without it) and the server lays ' +
      'them out into A-D and hands you back the line to display. Due items come first per FSRS, topped up with NEW items ' +
      'within settings.grammarLevels. isNew=true → give a SHORT introduction (meaning + structure) before ' +
      'asking. PICK RANDOMLY among the returned items (never always the first) so the quiz stays hard to ' +
      'guess. YOU build the 3 distractors yourself (other, easily confused grammar patterns). Grade via ' +
      'stage_sentence + submit_review (one rating for that pattern).',
    {
      count: z.number().int().min(1).max(3).optional(),
    },
    guard('get_quiz_items', async ({ count }, extra: unknown) =>
      ok(await getQuizBatch(getUserId(extra), 'GRAMMAR', count ?? 1)),
    ),
  );

  server.tool(
    'skip_sentence',
    'SKIP a pending sentence (already staged via stage_sentence, but the user has not answered): the ' +
      'sentence is SAVED to history with its frozen reference translation, but does NOT count toward ' +
      'FSRS (skipping is NOT grading — no rating, no ReviewLog). Use it when the user says "bỏ qua" / ' +
      '"skip" for the current sentence. sentenceId = the id returned by stage_sentence. Returns ' +
      '{ skipped } = how many patterns that sentence carried (informational only; none were graded).',
    { sentenceId: ID },
    guard('skip_sentence', async ({ sentenceId }, extra: unknown) =>
      ok(await skipSentence(getUserId(extra), sentenceId)),
    ),
  );
}
