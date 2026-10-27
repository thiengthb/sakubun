-- Roadmap 7.1d (docs/decisions/0006-per-user-learning-data.md): userId becomes required on the eight
-- learning tables, and an Item is unique per learner: (userId, kind, expression).
--
-- Backfill first, as 20261026050000_learning_owner_backfill did: a row written or restored without an
-- owner since then goes to the first account. With no account at all the copy below fails on the
-- NOT NULL column, on purpose: learning rows are never dropped to make the migration pass.
UPDATE "Item" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "SrsState" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "ReviewLog" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Sentence" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Turn" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "Group" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;
UPDATE "GroupMember" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1) WHERE "userId" IS NULL;

-- Settings: the first account gets the lowest unowned row only when it has none yet (userId is unique).
UPDATE "Settings" SET "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1)
WHERE "id" = (SELECT MIN("id") FROM "Settings" WHERE "userId" IS NULL)
  AND NOT EXISTS (SELECT 1 FROM "Settings" WHERE "userId" = (SELECT "id" FROM "user" ORDER BY ("role" = 'admin') DESC, "createdAt", "id" LIMIT 1));
-- Any Settings row still unowned is a duplicate no query has read since 7.1b (each learner reads only
-- their own row), so it goes.
DELETE FROM "Settings" WHERE "userId" IS NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'mixed',
    "color" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Group_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Group" ("color", "createdAt", "id", "kind", "name", "note", "updatedAt", "userId") SELECT "color", "createdAt", "id", "kind", "name", "note", "updatedAt", "userId" FROM "Group";
DROP TABLE "Group";
ALTER TABLE "new_Group" RENAME TO "Group";
CREATE INDEX "Group_userId_idx" ON "Group"("userId");
CREATE TABLE "new_GroupMember" (
    "groupId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("groupId", "itemId"),
    CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMember_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GroupMember" ("addedAt", "groupId", "itemId", "userId") SELECT "addedAt", "groupId", "itemId", "userId" FROM "GroupMember";
DROP TABLE "GroupMember";
ALTER TABLE "new_GroupMember" RENAME TO "GroupMember";
CREATE INDEX "GroupMember_itemId_idx" ON "GroupMember"("itemId");
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "expression" TEXT NOT NULL,
    "reading" TEXT,
    "hanviet" TEXT,
    "meaningVi" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'N5',
    "notes" TEXT,
    "tags" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "captureReason" TEXT,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "enrichment" TEXT,
    "enrichedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("captureReason", "createdAt", "enrichedAt", "enrichment", "expression", "hanviet", "id", "kind", "level", "meaningVi", "notes", "reading", "source", "starred", "suspended", "tags", "userId") SELECT "captureReason", "createdAt", "enrichedAt", "enrichment", "expression", "hanviet", "id", "kind", "level", "meaningVi", "notes", "reading", "source", "starred", "suspended", "tags", "userId" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_kind_idx" ON "Item"("kind");
CREATE UNIQUE INDEX "Item_userId_kind_expression_key" ON "Item"("userId", "kind", "expression");
CREATE TABLE "new_ReviewLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT,
    "rating" INTEGER NOT NULL,
    "state" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TARGET',
    "errorTags" TEXT,
    "errorDetail" TEXT,
    "due" DATETIME NOT NULL,
    "stability" REAL NOT NULL,
    "difficulty" REAL NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentenceId" TEXT,
    "turnId" TEXT,
    "channel" TEXT,
    CONSTRAINT "ReviewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReviewLog_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "Sentence" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReviewLog_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "Turn" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ReviewLog" ("channel", "difficulty", "due", "errorDetail", "errorTags", "id", "itemId", "rating", "reviewedAt", "role", "sentenceId", "stability", "state", "turnId", "userId") SELECT "channel", "difficulty", "due", "errorDetail", "errorTags", "id", "itemId", "rating", "reviewedAt", "role", "sentenceId", "stability", "state", "turnId", "userId" FROM "ReviewLog";
DROP TABLE "ReviewLog";
ALTER TABLE "new_ReviewLog" RENAME TO "ReviewLog";
CREATE INDEX "ReviewLog_reviewedAt_idx" ON "ReviewLog"("reviewedAt");
CREATE INDEX "ReviewLog_itemId_reviewedAt_idx" ON "ReviewLog"("itemId", "reviewedAt");
CREATE INDEX "ReviewLog_rating_reviewedAt_idx" ON "ReviewLog"("rating", "reviewedAt");
CREATE INDEX "ReviewLog_userId_reviewedAt_idx" ON "ReviewLog"("userId", "reviewedAt");
CREATE TABLE "new_Sentence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "context" TEXT,
    "exerciseType" TEXT NOT NULL DEFAULT 'TRANSLATION',
    "sourceText" TEXT NOT NULL,
    "sourceRuby" TEXT,
    "userAnswer" TEXT NOT NULL,
    "suggested" TEXT,
    "suggestedRuby" TEXT,
    "feedback" TEXT,
    "score" INTEGER,
    "stagedItems" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" DATETIME,
    CONSTRAINT "Sentence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Sentence" ("answeredAt", "context", "createdAt", "direction", "exerciseType", "feedback", "id", "score", "sourceRuby", "sourceText", "stagedItems", "starred", "status", "suggested", "suggestedRuby", "userAnswer", "userId") SELECT "answeredAt", "context", "createdAt", "direction", "exerciseType", "feedback", "id", "score", "sourceRuby", "sourceText", "stagedItems", "starred", "status", "suggested", "suggestedRuby", "userAnswer", "userId" FROM "Sentence";
DROP TABLE "Sentence";
ALTER TABLE "new_Sentence" RENAME TO "Sentence";
CREATE INDEX "Sentence_createdAt_idx" ON "Sentence"("createdAt");
CREATE INDEX "Sentence_userId_createdAt_idx" ON "Sentence"("userId", "createdAt");
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Settings" ("data", "id", "updatedAt", "userId") SELECT "data", "id", "updatedAt", "userId" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE UNIQUE INDEX "Settings_userId_key" ON "Settings"("userId");
CREATE TABLE "new_SrsState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "due" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stability" REAL NOT NULL DEFAULT 0,
    "difficulty" REAL NOT NULL DEFAULT 0,
    "scheduledDays" INTEGER NOT NULL DEFAULT 0,
    "learningSteps" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "state" INTEGER NOT NULL DEFAULT 0,
    "lastReview" DATETIME,
    CONSTRAINT "SrsState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SrsState_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SrsState" ("difficulty", "due", "id", "itemId", "lapses", "lastReview", "learningSteps", "reps", "scheduledDays", "stability", "state", "userId") SELECT "difficulty", "due", "id", "itemId", "lapses", "lastReview", "learningSteps", "reps", "scheduledDays", "stability", "state", "userId" FROM "SrsState";
DROP TABLE "SrsState";
ALTER TABLE "new_SrsState" RENAME TO "SrsState";
CREATE UNIQUE INDEX "SrsState_itemId_key" ON "SrsState"("itemId");
CREATE INDEX "SrsState_due_idx" ON "SrsState"("due");
CREATE INDEX "SrsState_state_idx" ON "SrsState"("state");
CREATE INDEX "SrsState_userId_due_idx" ON "SrsState"("userId", "due");
CREATE TABLE "new_Turn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemId" TEXT,
    "direction" TEXT NOT NULL,
    "ja" TEXT NOT NULL,
    "jaRuby" TEXT,
    "vi" TEXT NOT NULL,
    "hint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'staged',
    "answer" TEXT,
    "rating" INTEGER,
    "hinted" BOOLEAN NOT NULL DEFAULT false,
    "errorTags" TEXT,
    "feedback" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" DATETIME,
    CONSTRAINT "Turn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Turn_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Turn" ("answer", "createdAt", "direction", "errorTags", "feedback", "gradedAt", "hint", "hinted", "id", "itemId", "ja", "jaRuby", "rating", "status", "userId", "vi") SELECT "answer", "createdAt", "direction", "errorTags", "feedback", "gradedAt", "hint", "hinted", "id", "itemId", "ja", "jaRuby", "rating", "status", "userId", "vi" FROM "Turn";
DROP TABLE "Turn";
ALTER TABLE "new_Turn" RENAME TO "Turn";
CREATE INDEX "Turn_createdAt_idx" ON "Turn"("createdAt");
CREATE INDEX "Turn_status_createdAt_idx" ON "Turn"("status", "createdAt");
CREATE INDEX "Turn_userId_createdAt_idx" ON "Turn"("userId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
