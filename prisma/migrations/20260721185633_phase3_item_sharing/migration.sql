-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "expression" TEXT NOT NULL,
    "reading" TEXT,
    "hanviet" TEXT,
    "meaningVi" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'N5',
    "notes" TEXT,
    "tags" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "captureReason" TEXT,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "enrichment" TEXT,
    "enrichedAt" DATETIME,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "forkedFromId" TEXT,
    CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("captureReason", "createdAt", "enrichedAt", "enrichment", "expression", "hanviet", "id", "kind", "level", "meaningVi", "notes", "reading", "source", "starred", "suspended", "tags", "userId") SELECT "captureReason", "createdAt", "enrichedAt", "enrichment", "expression", "hanviet", "id", "kind", "level", "meaningVi", "notes", "reading", "source", "starred", "suspended", "tags", "userId" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_userId_idx" ON "Item"("userId");
CREATE INDEX "Item_visibility_idx" ON "Item"("visibility");
CREATE UNIQUE INDEX "Item_userId_kind_expression_key" ON "Item"("userId", "kind", "expression");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
