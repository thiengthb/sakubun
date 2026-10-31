-- AlterTable
ALTER TABLE "LibraryEntry" ADD COLUMN "body" TEXT;

-- AlterTable
ALTER TABLE "Script" ADD COLUMN "libraryEntryId" TEXT;
