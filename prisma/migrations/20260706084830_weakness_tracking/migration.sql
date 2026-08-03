-- AlterTable
ALTER TABLE "ReviewLog" ADD COLUMN "errorTags" TEXT;

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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Sentence" ("createdAt", "direction", "feedback", "id", "score", "sourceText", "suggested", "userAnswer") SELECT "createdAt", "direction", "feedback", "id", "score", "sourceText", "suggested", "userAnswer" FROM "Sentence";
DROP TABLE "Sentence";
ALTER TABLE "new_Sentence" RENAME TO "Sentence";
CREATE INDEX "Sentence_createdAt_idx" ON "Sentence"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
