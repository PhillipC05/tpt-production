-- AlterTable
ALTER TABLE "ProductListing" ADD COLUMN "category" TEXT;

-- CreateTable
CREATE TABLE "CustomOrderRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "request" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ProductListing_active_sourceType_category_idx" ON "ProductListing"("active", "sourceType", "category");

-- CreateIndex
CREATE INDEX "CustomOrderRequest_status_createdAt_idx" ON "CustomOrderRequest"("status", "createdAt");