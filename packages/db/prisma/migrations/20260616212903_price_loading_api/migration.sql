-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errorLog" JSONB,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProductListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "shopId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'LOCAL_PRINT',
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NZD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductListing_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "MakerShop" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductListing" ("active", "category", "createdAt", "currency", "description", "id", "price", "sourceType", "title", "updatedAt") SELECT "active", "category", "createdAt", "currency", "description", "id", "price", "sourceType", "title", "updatedAt" FROM "ProductListing";
DROP TABLE "ProductListing";
ALTER TABLE "new_ProductListing" RENAME TO "ProductListing";
CREATE INDEX "ProductListing_active_sourceType_category_idx" ON "ProductListing"("active", "sourceType", "category");
CREATE INDEX "ProductListing_shopId_active_idx" ON "ProductListing"("shopId", "active");
CREATE INDEX "ProductListing_externalId_idx" ON "ProductListing"("externalId");
CREATE UNIQUE INDEX "ProductListing_shopId_externalId_key" ON "ProductListing"("shopId", "externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ImportJob_status_createdAt_idx" ON "ImportJob"("status", "createdAt");
