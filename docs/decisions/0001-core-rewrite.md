# 0001. Rewrite the learning core, keep the UI

- Status: accepted in direction, details per PR
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

## Open

- Grammar and vocabulary as equal items in the queue: decided after reading kaiwa-canvas and wordquiz.
- Self-graded practice on the web (vocabulary quiz, flashcards) without an AI.
- OAuth on `/api/mcp` so the Claude web and mobile apps can connect.

## Consequences

The MCP tool surface and the protocol change shape; Claude Desktop and Hermes clients must follow the
new tools. Data migrations drop the Elo columns and the calibration table after a backup.
