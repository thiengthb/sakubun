-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sentence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "direction" TEXT NOT NULL,
    "context" TEXT,
    "exerciseType" TEXT NOT NULL DEFAULT 'TRANSLATION',
    "sourceText" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "suggested" TEXT,
    "feedback" TEXT,
    "score" INTEGER,
    "stagedItems" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Sentence" ("context", "createdAt", "direction", "exerciseType", "feedback", "id", "score", "sourceText", "suggested", "userAnswer") SELECT "context", "createdAt", "direction", "exerciseType", "feedback", "id", "score", "sourceText", "suggested", "userAnswer" FROM "Sentence";
DROP TABLE "Sentence";
ALTER TABLE "new_Sentence" RENAME TO "Sentence";
CREATE INDEX "Sentence_createdAt_idx" ON "Sentence"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill: rows that predate the status column and already have an answer are GRADED. The column
-- default ('PENDING') only correctly describes truly staged-but-unanswered rows (userAnswer = '').
UPDATE "Sentence" SET "status" = 'GRADED' WHERE "userAnswer" <> '';
