-- AlterTable
ALTER TABLE "Group" ADD COLUMN "libraryEntryId" TEXT;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN "libraryEntryId" TEXT;

-- CreateTable
CREATE TABLE "LibraryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "expression" TEXT,
    "reading" TEXT,
    "hanviet" TEXT,
    "meaningVi" TEXT,
    "level" TEXT,
    "notes" TEXT,
    "enrichment" TEXT,
    "name" TEXT,
    "groupKind" TEXT,
    "origin" TEXT NOT NULL,
    "authorId" TEXT,
    "sourceKey" TEXT,
    "basedOnId" TEXT,
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'public',
    "takeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryEntry_basedOnId_fkey" FOREIGN KEY ("basedOnId") REFERENCES "LibraryEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryGroupMember" (
    "groupEntryId" TEXT NOT NULL,
    "itemEntryId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    PRIMARY KEY ("groupEntryId", "itemEntryId"),
    CONSTRAINT "LibraryGroupMember_groupEntryId_fkey" FOREIGN KEY ("groupEntryId") REFERENCES "LibraryEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LibraryGroupMember_itemEntryId_fkey" FOREIGN KEY ("itemEntryId") REFERENCES "LibraryEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryLike" (
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("entryId", "userId"),
    CONSTRAINT "LibraryLike_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LibraryEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LibraryLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryEntry_sourceKey_key" ON "LibraryEntry"("sourceKey");

-- CreateIndex
CREATE INDEX "LibraryEntry_type_status_expression_idx" ON "LibraryEntry"("type", "status", "expression");

-- CreateIndex
CREATE INDEX "LibraryEntry_authorId_idx" ON "LibraryEntry"("authorId");

-- CreateIndex
CREATE INDEX "LibraryGroupMember_itemEntryId_idx" ON "LibraryGroupMember"("itemEntryId");

-- CreateIndex
CREATE INDEX "LibraryLike_userId_idx" ON "LibraryLike"("userId");
