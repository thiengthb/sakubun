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
| 3.2 | `v2` becomes default; remove old tools, prompts and `render.ts`; enforce token budget (#92, #94) | Done 2026-10-23: old tools, prompts and `render.ts` removed; budget enforced by `lib/mcp/token-budget.test.ts` | medium |
| 4.1 | OAuth on `/api/mcp` with better-auth, `ALLOWED_EMAIL` only (#95, #96, #97) | Done 2026-10-24: connector added on claude.ai works on the web and in the Claude phone app | high |
| 4.2 | Connected apps in Settings: list OAuth clients, revoke one (deferred from 4.1 by thien) | Done 2026-10-27 (#142): a revoked app gets 401 on its next call (consent is checked per call) and its refresh fails | high |
| 5.1 | Remove `coach`, `dossier`, `calibration`, `learner-notes`, the rest of `practice.ts` (#100, #101) | Done 2026-10-24: no old imports left; `practice.ts` keeps only live settings, item and stats reads (stats move in 5.3) | low |
| 5.2 | Migration dropping unused tables and columns (after backup) (#104) | Done 2026-10-24: `LearnerNote`, `LearnerAbility`, `CalibrationProposal`, `Item.challenge*`, `Sentence.extraPatterns` dropped; `McpToolCall` kept for the Settings "Dùng MCP" card; migration tested on a seeded DB copy | high |
| 5.3 | Dashboard from one stats source | Done 2026-10-25: `getDashboard` (`lib/insights/dashboard.ts`) reads once and `dashboard-model.ts` counts every number; old `getStats`, `getWeakReport`, `getAnalytics`, `getStudyStats` removed; dashboard e2e green | low |
| 5.4 | Shared skeleton, drop `dev-skeleton` | Done 2026-10-25: `PageShell` and `PageSkeleton` share `page-chrome.ts` (UI redo step 6). `dev-skeleton` stays, by thien's choice: it is the harness `e2e/skeleton.spec.ts` uses to compare each skeleton with its page, and it returns 404 in production. Next dev never shows a route's loading state on a held navigation, so dropping it would mean running that e2e on a production build | low |

Token targets (phase 3): tool definitions under 2,000 tokens, protocol under 1,500, each tool result
under 300.

## Phase 7: more than one learner

Approved by thien on 2026-10-25. Plan: `docs/plans/2026-10-25-phase7-1-per-user-data.md` (copied from
artifact 8dhCRanXdgsiDFTJBbUHdf, which only its own Claude account can open). Decision:
`docs/decisions/0006-per-user-learning-data.md`. Who is on which step now: `docs/STATUS.md`.

| # | PR | Done when | Risk | Status |
| --- | --- | --- | --- | --- |
| 7.1a | Nullable `userId` on the eight learning tables, existing rows given to the first account | Migration test on a seeded DB: every row owned, no other value changed | high | Done 2026-10-26 (#130) |
| 7.1b | `userDb(userId)` client; `lib/app` and MCP tools read and write through it | Guard tests green | high | Done 2026-10-26 (#131, with 7.1c) |
| 7.1c | Every other read and write through `userDb` | Two-user leak test: B never sees an id of A | high | Done 2026-10-26 (#131, with 7.1b) |
| 7.1d | `userId` required (backfill first), Item unique per user, bare client throws on learning tables, raw SQL scan | Bare-client test throws on each table | high | Done 2026-10-27 (#133) |
| 7.2 | Open sign-up with Google (thien can ban; changed 2026-10-27, plan `docs/plans/2026-10-27-phase7-2-sign-up.md`), admin page, MCP tool stats and database backup admin only, then 4.2 | A second account learns without seeing the first | high | Done 2026-10-27 (#138, #139, #140, #141, #142) |
| 7.3 | Hướng dẫn page (removed 2026-08-14) rewritten for today's app (plan `docs/plans/2026-10-27-phase7-3-guide.md`) | thien approves the screenshots | high | Done 2026-10-27 (#146, #147, #148) |
| 7.4 | Each new or changed page in the new UI, one PR per page | thien approves before and after screenshots | high | Todo |

## Phase 8: Kaiwa canvas and shared library

Asked for by thien on 2026-10-27, ahead of 7.4: Kaiwa canvas early, then the shared library (kho chung: a
community library of grammar and vocab seeded from OpenJLPT; new accounts start empty and take or publish items)
together with the UI redo and small bugs. Plan: `docs/plans/2026-10-27-phase-8-kaiwa-kho-chung.md` (approved
2026-10-27, #150). Order: K1-K5 (rough Kaiwa) first, then L1-L6, the quick review rework (C) and 7.4 together, then
K6-K9.

| # | PR | Done when | Risk | Status |
| --- | --- | --- | --- | --- |
| K1 | `Script` table, script parser, `lib/kaiwa/` save with format check | tests pass | high | Done 2026-10-27 (#151) |
| K2 | MCP `kaiwa_save`, `kaiwa_get`, `kaiwa_list`, prompt `kaiwa` | tried for real in claude.ai | high | Merged 2026-10-27 (#152), try in claude.ai pending |
| K3 | Hội thoại pages `/kaiwa`, `/kaiwa/[id]`: view, listen, hide meanings, delete (editing stays with the AI) | e2e + screenshots | high | In review |
| K4 | Automatic furigana and tokens on save (kuromoji; own reading alignment instead of kuroshiro) | tests, Docker image builds | high (column) | In review |
| K3b | Script page as a chat: learner picks their part (left), others right, speaker-less lines as the scene | e2e + screenshots | medium | In review |
| K3c | Edit and create scripts on the web, same check and version guard as MCP | e2e | medium | In review |
| K5 | Hover a word for its Vietnamese meaning, "Thêm vào kho" | e2e + screenshots | high | Todo |
| K6 | Karaoke, whole-script playback, voice per speaker, server audio cache | screenshots | medium | Todo |
| K7 | Publish scripts to kho chung | e2e | high | Todo |
| K8 | MCP role-play from a script | tried in claude.ai | high | Todo |
| K9 | Import the 5 old kaiwa-canvas scripts for thien | thien sees them | high | Todo |
| L1 | `LibraryEntry`, groups, likes, OpenJLPT seed, `lib/library/` take | tests pass | high | Todo |
| L2 | Kho chung page: groups and single items, take | e2e + screenshots | high | Todo |
| L3 | Publish items and groups, update, unpublish, based-on copies, likes | e2e | high | Todo |
| L4 | New accounts start empty, point to kho chung; decision 0008 | e2e | high | Todo |
| L5 | MCP `library_search`, `library_take` | tried in claude.ai | high | Todo |
| L6 | Admin hide/show entries, banned or deleted accounts | tests | high | Todo |
| C | Quick review rework (Vietnamese example translations, grammar leads with examples), own plan first | thien approves the plan and screenshots | high | Todo |
