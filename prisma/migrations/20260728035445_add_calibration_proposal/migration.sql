-- CreateTable
CREATE TABLE "CalibrationProposal" (
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
    "verdict" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "CalibrationProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CalibrationProposal_userId_createdAt_idx" ON "CalibrationProposal"("userId", "createdAt");
