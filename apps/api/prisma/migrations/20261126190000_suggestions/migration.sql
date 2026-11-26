-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "followToken" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "contact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEBIDA',
    "priority" TEXT,
    "dueDate" DATE,
    "prioritizedAt" TIMESTAMP(3),
    "response" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "handledByName" TEXT,
    "rating" INTEGER,
    "ratingComment" TEXT,
    "ratedAt" TIMESTAMP(3),
    "deviceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Suggestion_followToken_key" ON "Suggestion"("followToken");

-- CreateIndex
CREATE INDEX "Suggestion_tenantId_status_idx" ON "Suggestion"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Suggestion_tenantId_createdAt_idx" ON "Suggestion"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Suggestion_unitId_idx" ON "Suggestion"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Suggestion_tenantId_protocol_key" ON "Suggestion"("tenantId", "protocol");

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

