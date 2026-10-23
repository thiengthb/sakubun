# Roadmap: core rewrite (v2)

Approved by thien on 2026-10-23. Decision: `docs/decisions/0001-core-rewrite.md`. The app stays runnable
and deployable after every PR; thien tries each phase on the NUC before the next one starts. Risk labels
follow `nuc-infra/AGENTS.md`.

| # | PR | Done when | Risk |
| --- | --- | --- | --- |
| 0.1 | Working agreement + decision 0001 + this roadmap (#74) | thien merges | high |
| 0.2 | Characterization tests of today's behaviour + first token measurement | CI prints today's token counts | low |
| 1.1 | `lib/domain`: queue (separate caps for grammar and vocabulary), turn state machine, grading rules; not wired in | Domain tests green | low |
| 1.2 | `lib/app/recordReview` + `getQueue`; old `submitReview` goes through `recordReview` | Characterization tests still green | medium |
| 1.3 | Eight settings (migrate old settings) + lean Settings tab | Settings e2e green | medium |
| 2.1 | Clickable flashcard prototypes, two directions (not a PR) | Done: thien picked B, context first (sentence with the target underlined, answer revealed below) | - |
| 2.2 | Cloze builder from example sentences (WordQuiz algorithm) | Tests: one right answer, four distinct choices, answer not leaked | low |
| 2.3 | `/review` page + the single card component, wired to `answerCard` | e2e at 390px and desktop | medium |
| 2.4 | PWA (manifest, icon) | Installs on a phone home screen | low |
| 2.5 | Remove the three old flashcards; Groups and History use the new card | Frontend rules green | low |
| 3.1 | `Turn` table (migrated from `Sentence`) + seven v2 tools in a `v2` profile, beside the old ones | MCP v2 e2e green | medium |
| 3.2 | `v2` becomes default; remove old tools, prompts and `render.ts`; enforce token budget | Token targets met | medium |
| 4.1 | OAuth on `/api/mcp` with better-auth, `ALLOWED_EMAIL` only | Connector added on claude.ai works in the Claude phone app | high |
| 5.1 | Remove `coach`, `dossier`, `calibration`, `learner-notes`, the rest of `practice.ts` | No old imports left | low |
| 5.2 | Migration dropping unused tables and columns (after backup) | Data migration tested on a DB copy | high |
| 5.3 | Dashboard from one stats source | Dashboard e2e green | low |
| 5.4 | Shared skeleton, drop `dev-skeleton` | Frontend rules green | low |

Token targets (phase 3): tool definitions under 2,000 tokens, protocol under 1,500, each tool result
under 300.
