-- CreateTable
CREATE TABLE "Roleplay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "scriptTitle" TEXT NOT NULL,
    "part" TEXT NOT NULL,
    "turns" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Roleplay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Roleplay_userId_createdAt_idx" ON "Roleplay"("userId", "createdAt");
