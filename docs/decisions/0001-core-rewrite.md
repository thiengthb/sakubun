# 0001. Rewrite the learning core, keep the UI

- Status: accepted (plan approved by thien on 2026-10-23), details per PR
- Date: 2026-10-23

## Context

The learning core grew by patching: `lib/library/practice.ts` holds settings, item writes, batch
selection, grading, Elo, calibration, stats, quiz and enrichment in one file. About 100 KB of tutor
protocol and rendered blocks (`lib/mcp/prompts.ts`, `lib/mcp/render.ts`) carry rules the server could
enforce, and a full session starts at roughly 25K tokens before the first sentence. Several learner
models overlap; the Elo ability and item challenge are written but never read for a decision. The UI is
good and the learner wants it kept.

## Decision

- Rewrite the core step by step under the existing UI, one runnable PR at a time.
- One practice turn has exactly one target item, either a grammar pattern or a vocabulary word. Other
  words in the sentence are background and are not rated.
- A turn is an explicit state machine (`staged -> answered -> graded | skipped`).
- FSRS is the only learner model for scheduling; Elo ability, item challenge and calibration proposals
  are removed.
- MCP stays lean: few tools, short descriptions, small results, rules enforced in code with short
  errors that name one fix. A fixed token budget test guards it.
- Cut: the conversation practice mode, long passages (`huge`, `paragraph`, `story_practice`), and the
  quiz flow where the AI writes and grades the options.

- Grammar and vocabulary are equal items in one FSRS queue, each with its own daily new cap (defaults:
  5 grammar, 15 vocabulary). Items never studied are not due.
- Two ways to practise on the same queue: quick review on the web (flip card, two buttons, four since
  0005; cloze with four choices built deterministically from example sentences, graded by the server),
  and translation turns with Claude over MCP (rated 1-4).
- Sentence settings are derived from the item, not filled in a form: FSRS state picks the direction
  (new or learning: Japanese to Vietnamese; stable: Vietnamese to Japanese), the JLPT level picks the
  length, one step easier while new. Overrides spoken in chat travel as a `hint` and are not saved.
  The web keeps eight settings: JLPT level, new grammar per day, new vocabulary per day, max reviews per
  day, direction mode, furigana, voice, rate (plus retention and day cutoff under advanced).
- The explanation card has five fields: meaning, structure, at most two examples (ja, vi, ruby), one
  note, register. Filled from imported data first; Claude fills a missing field the first time the item
  is taught, through `stage_turn`. No versions, quality tiers, merge engine or bulk enrichment.
  Synonyms and antonyms are optional extras, not required.
- `LearnerNote` and `McpToolCall` are removed with the other unused tables, after a backup.
- OAuth on `/api/mcp` (better-auth) so the Claude web and mobile apps can connect; Bearer stays for
  Claude Desktop and Hermes.
- Order and PR list: `docs/roadmap.md`.

## Consequences

The MCP tool surface and the protocol change shape; Claude Desktop and Hermes clients must follow the
new tools. Data migrations drop the Elo columns and the calibration table after a backup.
