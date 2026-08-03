-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    CONSTRAINT "ReviewLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReviewLog_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "Sentence" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ReviewLog" ("difficulty", "due", "errorTags", "id", "itemId", "rating", "reviewedAt", "role", "sentenceId", "stability", "state") SELECT "difficulty", "due", "errorTags", "id", "itemId", "rating", "reviewedAt", "role", "sentenceId", "stability", "state" FROM "ReviewLog";
DROP TABLE "ReviewLog";
ALTER TABLE "new_ReviewLog" RENAME TO "ReviewLog";
CREATE INDEX "ReviewLog_reviewedAt_idx" ON "ReviewLog"("reviewedAt");
CREATE INDEX "ReviewLog_itemId_reviewedAt_idx" ON "ReviewLog"("itemId", "reviewedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
