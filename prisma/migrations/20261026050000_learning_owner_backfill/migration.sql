-- Roadmap 7.1b: from this release every learning query reads only the learner's own rows.
-- Rows written after 20261025230000_learning_owner but before this release have no owner and would
-- vanish from the app, so they go to the same first account. Data only, no schema change.
UPDATE "Item" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "SrsState" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "ReviewLog" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Sentence" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Turn" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Group" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "GroupMember" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;

-- Settings: only when that account has no row yet (userId is unique), and only the lowest id, the
-- row the app used to read.
UPDATE "Settings" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1)
WHERE "id" = (SELECT MIN("id") FROM "Settings" WHERE "userId" IS NULL)
  AND NOT EXISTS (SELECT 1 FROM "Settings" WHERE "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1));
