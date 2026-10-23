-- CreateTable
CREATE TABLE "Turn" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "Turn_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AlterTable: plain ADD COLUMN instead of Prisma's table rebuild, so existing review history is
-- never copied. Old rows keep both columns null.
ALTER TABLE "ReviewLog" ADD COLUMN "turnId" TEXT REFERENCES "Turn" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewLog" ADD COLUMN "channel" TEXT;

-- CreateIndex
CREATE INDEX "Turn_createdAt_idx" ON "Turn"("createdAt");

-- CreateIndex
CREATE INDEX "Turn_status_createdAt_idx" ON "Turn"("status", "createdAt");
