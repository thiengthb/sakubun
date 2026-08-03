-- CreateTable
CREATE TABLE "LearnerAbility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "abilityReceptive" REAL NOT NULL DEFAULT 1000,
    "receptiveObservations" INTEGER NOT NULL DEFAULT 0,
    "abilityProductive" REAL NOT NULL DEFAULT 1000,
    "productiveObservations" INTEGER NOT NULL DEFAULT 0,
    "abilityRegister" REAL NOT NULL DEFAULT 1000,
    "registerObservations" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "LearnerAbility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "challenge" REAL,
    "challengeObservations" INTEGER NOT NULL DEFAULT 0,
    "forkedFromId" TEXT,
    CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("captureReason", "createdAt", "enrichedAt", "enrichment", "expression", "forkedFromId", "hanviet", "id", "kind", "level", "meaningVi", "notes", "reading", "source", "starred", "suspended", "tags", "userId", "visibility") SELECT "captureReason", "createdAt", "enrichedAt", "enrichment", "expression", "forkedFromId", "hanviet", "id", "kind", "level", "meaningVi", "notes", "reading", "source", "starred", "suspended", "tags", "userId", "visibility" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_userId_idx" ON "Item"("userId");
CREATE INDEX "Item_visibility_idx" ON "Item"("visibility");
CREATE INDEX "Item_userId_kind_idx" ON "Item"("userId", "kind");
CREATE INDEX "Item_visibility_createdAt_idx" ON "Item"("visibility", "createdAt");
CREATE UNIQUE INDEX "Item_userId_kind_expression_key" ON "Item"("userId", "kind", "expression");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "LearnerAbility_userId_key" ON "LearnerAbility"("userId");
