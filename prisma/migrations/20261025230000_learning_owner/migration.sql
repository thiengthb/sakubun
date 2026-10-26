-- Roadmap 7.1a (docs/decisions/0006-per-user-learning-data.md): every learning row gets an owner.
--
-- AlterTable: plain ADD COLUMN instead of Prisma's table rebuild, so no learning row is copied or
-- rewritten except for the one new column. The column stays nullable until 7.1d, when every query
-- goes through the per-user client and a second migration makes it required.

ALTER TABLE "Item" ADD COLUMN "userId" TEXT REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SrsState" ADD COLUMN "userId" TEXT REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewLog" ADD COLUMN "userId" TEXT REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sentence" ADD COLUMN "userId" TEXT REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Turn" ADD COLUMN "userId" TEXT REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Group" ADD COLUMN "userId" TEXT REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD COLUMN "userId" TEXT REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Settings" ADD COLUMN "userId" TEXT REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: until now the app had exactly one learner, the first account (sign-up closes after it,
-- and lib/auth/auth.ts makes it admin). Every existing row goes to that account. With no account
-- yet (a fresh install), the rows stay unowned and 7.1d assigns them.
UPDATE "Item" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "SrsState" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "ReviewLog" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Sentence" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Turn" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Group" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "GroupMember" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
-- Settings: the app only ever read the lowest id, so only that row gets the owner (userId is unique).
UPDATE "Settings" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "id" = (SELECT MIN("id") FROM "Settings");

-- CreateIndex
CREATE INDEX "Item_userId_idx" ON "Item"("userId");

-- CreateIndex
CREATE INDEX "SrsState_userId_due_idx" ON "SrsState"("userId", "due");

-- CreateIndex
CREATE INDEX "ReviewLog_userId_reviewedAt_idx" ON "ReviewLog"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "Sentence_userId_createdAt_idx" ON "Sentence"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Turn_userId_createdAt_idx" ON "Turn"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Group_userId_idx" ON "Group"("userId");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_userId_key" ON "Settings"("userId");
