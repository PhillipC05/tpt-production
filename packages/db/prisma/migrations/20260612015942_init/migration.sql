-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CONSUMER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MakerShop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationLat" REAL NOT NULL,
    "locationLng" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MakerShop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShopCapability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "machineType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopCapability_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "MakerShop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "apiConfig" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProductListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'LOCAL_PRINT',
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NZD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DesignFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT,
    "uploaderId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "drmEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DesignFile_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ProductListing" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DesignFile_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DesignRoyalty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "designFileId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DesignRoyalty_designFileId_fkey" FOREIGN KEY ("designFileId") REFERENCES "DesignFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DesignRoyalty_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DesignRoyalty_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "listingId" TEXT,
    "designFileId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ProductListing" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_designFileId_fkey" FOREIGN KEY ("designFileId") REFERENCES "DesignFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FulfillmentJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "shopId" TEXT,
    "supplierId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "acceptedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FulfillmentJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FulfillmentJob_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "MakerShop" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FulfillmentJob_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoutingDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "shopId" TEXT,
    "geoScore" REAL NOT NULL DEFAULT 0,
    "costScore" REAL NOT NULL DEFAULT 0,
    "capacityScore" REAL NOT NULL DEFAULT 0,
    "capabilityScore" REAL NOT NULL DEFAULT 0,
    "totalScore" REAL NOT NULL DEFAULT 0,
    "chosen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoutingDecision_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoutingDecision_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "MakerShop" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "lat" REAL,
    "lng" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'COURIER',
    "externalRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "balance" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CreditAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'EARNED',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CreditAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FIXED',
    "decaySchedule" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PricingRule_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ProductListing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT '',
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "MakerShop_userId_key" ON "MakerShop"("userId");

-- CreateIndex
CREATE INDEX "MakerShop_active_locationLat_locationLng_idx" ON "MakerShop"("active", "locationLat", "locationLng");

-- CreateIndex
CREATE INDEX "ShopCapability_material_machineType_category_idx" ON "ShopCapability"("material", "machineType", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ShopCapability_shopId_material_machineType_category_key" ON "ShopCapability"("shopId", "material", "machineType", "category");

-- CreateIndex
CREATE INDEX "Supplier_active_idx" ON "Supplier"("active");

-- CreateIndex
CREATE INDEX "ProductListing_active_sourceType_idx" ON "ProductListing"("active", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "DesignFile_fileKey_key" ON "DesignFile"("fileKey");

-- CreateIndex
CREATE INDEX "DesignFile_uploaderId_idx" ON "DesignFile"("uploaderId");

-- CreateIndex
CREATE INDEX "DesignRoyalty_recipientId_idx" ON "DesignRoyalty"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignRoyalty_orderId_designFileId_recipientId_key" ON "DesignRoyalty"("orderId", "designFileId", "recipientId");

-- CreateIndex
CREATE INDEX "Order_userId_status_idx" ON "Order"("userId", "status");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_listingId_designFileId_idx" ON "OrderItem"("orderId", "listingId", "designFileId");

-- CreateIndex
CREATE INDEX "FulfillmentJob_orderId_status_idx" ON "FulfillmentJob"("orderId", "status");

-- CreateIndex
CREATE INDEX "FulfillmentJob_shopId_supplierId_idx" ON "FulfillmentJob"("shopId", "supplierId");

-- CreateIndex
CREATE INDEX "RoutingDecision_orderId_chosen_idx" ON "RoutingDecision"("orderId", "chosen");

-- CreateIndex
CREATE INDEX "RoutingDecision_shopId_totalScore_idx" ON "RoutingDecision"("shopId", "totalScore");

-- CreateIndex
CREATE INDEX "TrackingEvent_orderId_createdAt_idx" ON "TrackingEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "TrackingEvent_source_status_idx" ON "TrackingEvent"("source", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAssignment_orderId_key" ON "DeliveryAssignment"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_method_idx" ON "DeliveryAssignment"("method");

-- CreateIndex
CREATE UNIQUE INDEX "CreditAccount_userId_key" ON "CreditAccount"("userId");

-- CreateIndex
CREATE INDEX "CreditTransaction_accountId_createdAt_type_idx" ON "CreditTransaction"("accountId", "createdAt", "type");

-- CreateIndex
CREATE INDEX "PricingRule_listingId_type_idx" ON "PricingRule"("listingId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");
