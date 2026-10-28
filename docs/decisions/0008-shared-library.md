# 0008. A shared library; new accounts start empty

- Status: accepted (thien approved the phase 8 plan 2026-10-27, #150)
- Date: 2026-10-27
- Amends: 0007 ("a new learner starts with their own OpenJLPT deck")
- Plan: `docs/plans/2026-10-27-phase-8-kaiwa-kho-chung.md`, part A

## Context

Since 7.2 every new account got a private copy of all of OpenJLPT, about 8,000 items with their own
schedules, before the learner had chosen anything. thien wants a library like Quizlet instead: shared
grammar and vocabulary that anyone can browse, take a copy of, and add to.

## Decision

- **Kho chung** (`LibraryEntry`, `LibraryGroupMember`, `LibraryLike`) holds snapshots, never a learner's
  live rows. It is not a learning table: it is read with the shared client, and every write goes through
  `lib/library/shared.ts`, `take.ts`, `publish.ts` and `likes.ts`, which check the author in code.
- **OpenJLPT is seeded into it**, as entries and as ready-made level groups ("N5 · Ngữ pháp" and so on).
  The seed runs on the first read and only adds what is missing.
- **Taking** copies an entry into the learner's own items with a fresh FSRS schedule and a
  `libraryEntryId` link. A learner has one item per kind and expression, so taking something they
  already have adds nothing. Taking a group makes their own group of the same name.
- **Publishing** happens only on the web, by the learner pressing Chia sẻ; no MCP tool can do it. Only
  the expression, reading, Hán Việt, meaning and level go out. A copy taken and not edited cannot be
  published again; an edited one is published as "based on" its source. Taking a share down hides it,
  and takers keep their copies.
- **New accounts start empty.** Phân tích offers OpenJLPT's N5 grammar in one click and links to Kho
  chung. Accounts that already have their deck keep it untouched.

## Consequences

- Signing up no longer writes 8,000 rows, and no longer fails when that write fails.
- A new learner who skips Phân tích and goes straight to Claude has nothing to practise until they or
  Claude add items. The guide says so in its second step.
- `lib/import/starter-deck.ts` only loads the deck now; its per-learner seeding is gone.
- Hiding entries of banned or deleted accounts, and admin hide/show, come in L6.
