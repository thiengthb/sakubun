-- AlterTable
ALTER TABLE "ReviewLog" ADD COLUMN "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ReviewLog_userId_clientId_key" ON "ReviewLog"("userId", "clientId");

