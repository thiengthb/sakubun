-- DropIndex
DROP INDEX "LearnerNote_expiresAt_idx";

-- DropIndex
DROP INDEX "CalibrationProposal_createdAt_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "LearnerNote";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "LearnerAbility";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CalibrationProposal";
PRAGMA foreign_keys=on;

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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Item" ("captureReason", "createdAt", "enrichedAt", "enrichment", "expression", "hanviet", "id", "kind", "level", "meaningVi", "notes", "reading", "source", "starred", "suspended", "tags") SELECT "captureReason", "createdAt", "enrichedAt", "enrichment", "expression", "hanviet", "id", "kind", "level", "meaningVi", "notes", "reading", "source", "starred", "suspended", "tags" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_kind_idx" ON "Item"("kind");
CREATE UNIQUE INDEX "Item_kind_expression_key" ON "Item"("kind", "expression");
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
    "answeredAt" DATETIME
);
INSERT INTO "new_Sentence" ("answeredAt", "context", "createdAt", "direction", "exerciseType", "feedback", "id", "score", "sourceRuby", "sourceText", "stagedItems", "starred", "status", "suggested", "suggestedRuby", "userAnswer") SELECT "answeredAt", "context", "createdAt", "direction", "exerciseType", "feedback", "id", "score", "sourceRuby", "sourceText", "stagedItems", "starred", "status", "suggested", "suggestedRuby", "userAnswer" FROM "Sentence";
DROP TABLE "Sentence";
ALTER TABLE "new_Sentence" RENAME TO "Sentence";
CREATE INDEX "Sentence_createdAt_idx" ON "Sentence"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

