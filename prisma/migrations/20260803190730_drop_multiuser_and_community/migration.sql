/*
  Warnings:

  - You are about to drop the `Comment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CommentVote` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GroupMember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ItemLike` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SentenceLike` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `userId` on the `CalibrationProposal` table. All the data in the column will be lost.
  - You are about to drop the column `forkedFromId` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `visibility` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `LearnerAbility` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `LearnerNote` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ReviewLog` table. All the data in the column will be lost.
  - You are about to drop the column `sharedAt` on the `Sentence` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Sentence` table. All the data in the column will be lost.
  - You are about to drop the column `visibility` on the `Sentence` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `SrsState` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Comment_authorId_idx";

-- DropIndex
DROP INDEX "Comment_sentenceId_createdAt_idx";

-- DropIndex
DROP INDEX "CommentVote_commentId_userId_key";

-- DropIndex
DROP INDEX "CommentVote_commentId_idx";

-- DropIndex
DROP INDEX "Group_userId_idx";

-- DropIndex
DROP INDEX "GroupMember_userId_idx";

-- DropIndex
DROP INDEX "GroupMember_itemId_idx";

-- DropIndex
DROP INDEX "ItemLike_itemId_userId_key";

-- DropIndex
DROP INDEX "ItemLike_itemId_idx";

-- DropIndex
DROP INDEX "Notification_userId_kind_readAt_idx";

-- DropIndex
DROP INDEX "Notification_userId_createdAt_idx";

-- DropIndex
DROP INDEX "Notification_userId_readAt_idx";

-- DropIndex
DROP INDEX "SentenceLike_sentenceId_userId_key";

-- DropIndex
DROP INDEX "SentenceLike_sentenceId_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Comment";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CommentVote";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Group";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "GroupMember";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ItemLike";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Notification";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SentenceLike";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CalibrationProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "target" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "fromValue" TEXT NOT NULL,
    "toValue" TEXT NOT NULL,
    "axis" TEXT NOT NULL,
    "measured" REAL NOT NULL,
    "ability" REAL NOT NULL,
    "observations" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "sentenceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verdict" TEXT
);
INSERT INTO "new_CalibrationProposal" ("ability", "axis", "createdAt", "direction", "fromValue", "id", "measured", "observations", "reason", "sentenceId", "target", "toValue", "verdict") SELECT "ability", "axis", "createdAt", "direction", "fromValue", "id", "measured", "observations", "reason", "sentenceId", "target", "toValue", "verdict" FROM "CalibrationProposal";
DROP TABLE "CalibrationProposal";
ALTER TABLE "new_CalibrationProposal" RENAME TO "CalibrationProposal";
CREATE INDEX "CalibrationProposal_createdAt_idx" ON "CalibrationProposal"("createdAt");
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
    "challenge" REAL,
    "challengeObservations" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Item" ("captureReason", "challenge", "challengeObservations", "createdAt", "enrichedAt", "enrichment", "expression", "hanviet", "id", "kind", "level", "meaningVi", "notes", "reading", "source", "starred", "suspended", "tags") SELECT "captureReason", "challenge", "challengeObservations", "createdAt", "enrichedAt", "enrichment", "expression", "hanviet", "id", "kind", "level", "meaningVi", "notes", "reading", "source", "starred", "suspended", "tags" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_kind_idx" ON "Item"("kind");
CREATE UNIQUE INDEX "Item_kind_expression_key" ON "Item"("kind", "expression");
CREATE TABLE "new_LearnerAbility" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "abilityReceptive" REAL NOT NULL DEFAULT 1000,
    "receptiveObservations" INTEGER NOT NULL DEFAULT 0,
    "abilityProductive" REAL NOT NULL DEFAULT 1000,
    "productiveObservations" INTEGER NOT NULL DEFAULT 0,
    "abilityRegister" REAL NOT NULL DEFAULT 1000,
    "registerObservations" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_LearnerAbility" ("abilityProductive", "abilityReceptive", "abilityRegister", "id", "productiveObservations", "receptiveObservations", "registerObservations", "updatedAt") SELECT "abilityProductive", "abilityReceptive", "abilityRegister", "id", "productiveObservations", "receptiveObservations", "registerObservations", "updatedAt" FROM "LearnerAbility";
DROP TABLE "LearnerAbility";
ALTER TABLE "new_LearnerAbility" RENAME TO "LearnerAbility";
CREATE TABLE "new_LearnerNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);
INSERT INTO "new_LearnerNote" ("createdAt", "evidence", "expiresAt", "id", "text") SELECT "createdAt", "evidence", "expiresAt", "id", "text" FROM "LearnerNote";
DROP TABLE "LearnerNote";
ALTER TABLE "new_LearnerNote" RENAME TO "LearnerNote";
CREATE INDEX "LearnerNote_expiresAt_idx" ON "LearnerNote"("expiresAt");
CREATE TABLE "new_ReviewLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "ReviewLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReviewLog_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "Sentence" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ReviewLog" ("difficulty", "due", "errorDetail", "errorTags", "id", "itemId", "rating", "reviewedAt", "role", "sentenceId", "stability", "state") SELECT "difficulty", "due", "errorDetail", "errorTags", "id", "itemId", "rating", "reviewedAt", "role", "sentenceId", "stability", "state" FROM "ReviewLog";
DROP TABLE "ReviewLog";
ALTER TABLE "new_ReviewLog" RENAME TO "ReviewLog";
CREATE INDEX "ReviewLog_reviewedAt_idx" ON "ReviewLog"("reviewedAt");
CREATE INDEX "ReviewLog_itemId_reviewedAt_idx" ON "ReviewLog"("itemId", "reviewedAt");
CREATE INDEX "ReviewLog_rating_reviewedAt_idx" ON "ReviewLog"("rating", "reviewedAt");
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
    "extraPatterns" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" DATETIME
);
INSERT INTO "new_Sentence" ("answeredAt", "context", "createdAt", "direction", "exerciseType", "extraPatterns", "feedback", "id", "score", "sourceRuby", "sourceText", "stagedItems", "starred", "status", "suggested", "suggestedRuby", "userAnswer") SELECT "answeredAt", "context", "createdAt", "direction", "exerciseType", "extraPatterns", "feedback", "id", "score", "sourceRuby", "sourceText", "stagedItems", "starred", "status", "suggested", "suggestedRuby", "userAnswer" FROM "Sentence";
DROP TABLE "Sentence";
ALTER TABLE "new_Sentence" RENAME TO "Sentence";
CREATE INDEX "Sentence_createdAt_idx" ON "Sentence"("createdAt");
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "data" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("data", "id", "updatedAt") SELECT "data", "id", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
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
    CONSTRAINT "SrsState_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SrsState" ("difficulty", "due", "id", "itemId", "lapses", "lastReview", "learningSteps", "reps", "scheduledDays", "stability", "state") SELECT "difficulty", "due", "id", "itemId", "lapses", "lastReview", "learningSteps", "reps", "scheduledDays", "stability", "state" FROM "SrsState";
DROP TABLE "SrsState";
ALTER TABLE "new_SrsState" RENAME TO "SrsState";
CREATE UNIQUE INDEX "SrsState_itemId_key" ON "SrsState"("itemId");
CREATE INDEX "SrsState_due_idx" ON "SrsState"("due");
CREATE INDEX "SrsState_state_idx" ON "SrsState"("state");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
