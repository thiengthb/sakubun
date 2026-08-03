-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sentenceId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "Sentence" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "sharedAt" DATETIME,
    "userId" TEXT,
    CONSTRAINT "Sentence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sentence" ("answeredAt", "context", "createdAt", "direction", "exerciseType", "feedback", "id", "score", "sourceRuby", "sourceText", "stagedItems", "starred", "status", "suggested", "suggestedRuby", "userAnswer", "userId") SELECT "answeredAt", "context", "createdAt", "direction", "exerciseType", "feedback", "id", "score", "sourceRuby", "sourceText", "stagedItems", "starred", "status", "suggested", "suggestedRuby", "userAnswer", "userId" FROM "Sentence";
DROP TABLE "Sentence";
ALTER TABLE "new_Sentence" RENAME TO "Sentence";
CREATE INDEX "Sentence_createdAt_idx" ON "Sentence"("createdAt");
CREATE INDEX "Sentence_userId_createdAt_idx" ON "Sentence"("userId", "createdAt");
CREATE INDEX "Sentence_visibility_sharedAt_idx" ON "Sentence"("visibility", "sharedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Comment_sentenceId_createdAt_idx" ON "Comment"("sentenceId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");
