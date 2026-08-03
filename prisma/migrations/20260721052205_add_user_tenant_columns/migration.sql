-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "userId" TEXT,
    CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("captureReason", "createdAt", "enrichedAt", "enrichment", "expression", "hanviet", "id", "kind", "level", "meaningVi", "notes", "reading", "source", "starred", "suspended", "tags") SELECT "captureReason", "createdAt", "enrichedAt", "enrichment", "expression", "hanviet", "id", "kind", "level", "meaningVi", "notes", "reading", "source", "starred", "suspended", "tags" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_userId_idx" ON "Item"("userId");
CREATE UNIQUE INDEX "Item_kind_expression_key" ON "Item"("kind", "expression");
CREATE TABLE "new_ReviewLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT,
    "rating" INTEGER NOT NULL,
    "state" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TARGET',
    "errorTags" TEXT,
    "due" DATETIME NOT NULL,
    "stability" REAL NOT NULL,
    "difficulty" REAL NOT NULL,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentenceId" TEXT,
    "userId" TEXT,
    CONSTRAINT "ReviewLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReviewLog_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "Sentence" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReviewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ReviewLog" ("difficulty", "due", "errorTags", "id", "itemId", "rating", "reviewedAt", "role", "sentenceId", "stability", "state") SELECT "difficulty", "due", "errorTags", "id", "itemId", "rating", "reviewedAt", "role", "sentenceId", "stability", "state" FROM "ReviewLog";
DROP TABLE "ReviewLog";
ALTER TABLE "new_ReviewLog" RENAME TO "ReviewLog";
CREATE INDEX "ReviewLog_reviewedAt_idx" ON "ReviewLog"("reviewedAt");
CREATE INDEX "ReviewLog_itemId_reviewedAt_idx" ON "ReviewLog"("itemId", "reviewedAt");
CREATE INDEX "ReviewLog_userId_reviewedAt_idx" ON "ReviewLog"("userId", "reviewedAt");
CREATE TABLE "new_Sentence" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "userId" TEXT,
    CONSTRAINT "Sentence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sentence" ("answeredAt", "context", "createdAt", "direction", "exerciseType", "feedback", "id", "score", "sourceRuby", "sourceText", "stagedItems", "starred", "status", "suggested", "suggestedRuby", "userAnswer") SELECT "answeredAt", "context", "createdAt", "direction", "exerciseType", "feedback", "id", "score", "sourceRuby", "sourceText", "stagedItems", "starred", "status", "suggested", "suggestedRuby", "userAnswer" FROM "Sentence";
DROP TABLE "Sentence";
ALTER TABLE "new_Sentence" RENAME TO "Sentence";
CREATE INDEX "Sentence_createdAt_idx" ON "Sentence"("createdAt");
CREATE INDEX "Sentence_userId_createdAt_idx" ON "Sentence"("userId", "createdAt");
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "data" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Settings" ("data", "id", "updatedAt") SELECT "data", "id", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE UNIQUE INDEX "Settings_userId_key" ON "Settings"("userId");
CREATE TABLE "new_SrsState" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "userId" TEXT,
    CONSTRAINT "SrsState_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SrsState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SrsState" ("difficulty", "due", "id", "itemId", "lapses", "lastReview", "learningSteps", "reps", "scheduledDays", "stability", "state") SELECT "difficulty", "due", "id", "itemId", "lapses", "lastReview", "learningSteps", "reps", "scheduledDays", "stability", "state" FROM "SrsState";
DROP TABLE "SrsState";
ALTER TABLE "new_SrsState" RENAME TO "SrsState";
CREATE UNIQUE INDEX "SrsState_itemId_key" ON "SrsState"("itemId");
CREATE INDEX "SrsState_due_idx" ON "SrsState"("due");
CREATE INDEX "SrsState_userId_due_idx" ON "SrsState"("userId", "due");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
