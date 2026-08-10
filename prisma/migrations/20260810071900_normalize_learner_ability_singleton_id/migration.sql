-- Data-only repair: give the one ability row the id the schema says it has.
--
-- `LearnerAbility` was created on 2026-07-26 with a plain `id TEXT PRIMARY KEY` and one row PER USER,
-- so Prisma filled the id with a cuid. The 2026-08-03 drop-multiuser migration rebuilt the table with
-- `DEFAULT 'singleton'` — but its copy step was `INSERT ... SELECT "id" ... FROM "LearnerAbility"`,
-- and a column default never touches rows that already exist. So every DB that had already recorded a
-- graded turn kept its cuid, while every DB created after that date got 'singleton'. Dev, CI and the
-- test harness are all in the second group; the deploy is the only member of the first.
--
-- The consequence was not cosmetic. lib/practice.ts wrote the ability row by its hardcoded id, missed,
-- and Prisma raised P2025 — inside the transaction that also carries the FSRS write, the ReviewLog and
-- the item challenge. Every `submit_review` on the deploy rolled back whole: Claude graded the answer,
-- the learner read the feedback, and nothing was saved. Nine turns died that way on 2026-08-08.
--
-- The writer no longer depends on this id (it uses the row it just read), so this migration is about
-- making the DB match its own documented invariant rather than about keeping the app alive.
--
-- Guards, because a data migration that fails leaves the deploy unable to start:
--   * empty table          -> the subquery is NULL, no row matches, no-op
--   * already 'singleton'  -> excluded by both the `<>` and the NOT EXISTS check
--   * 'singleton' + legacy -> NOT EXISTS is false, no-op (renaming would break the primary key)
--   * two legacy rows      -> only the most recently written one is promoted, so no key collision
UPDATE "LearnerAbility"
SET "id" = 'singleton'
WHERE "id" = (SELECT "id" FROM "LearnerAbility" ORDER BY "updatedAt" DESC LIMIT 1)
  AND "id" <> 'singleton'
  AND NOT EXISTS (SELECT 1 FROM "LearnerAbility" WHERE "id" = 'singleton');
