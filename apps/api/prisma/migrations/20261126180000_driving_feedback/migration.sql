-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "passengerToken" TEXT;

-- CreateTable
CREATE TABLE "DrivingFeedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "checklistId" TEXT,
    "driverId" TEXT,
    "rating" INTEGER NOT NULL,
    "tags" TEXT[],
    "comment" TEXT,
    "contact" TEXT,
    "alert" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'NOVA',
    "treatment" TEXT,
    "treatedAt" TIMESTAMP(3),
    "treatedByName" TEXT,
    "deviceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrivingFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrivingFeedback_tenantId_createdAt_idx" ON "DrivingFeedback"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "DrivingFeedback_tenantId_status_idx" ON "DrivingFeedback"("tenantId", "status");

-- CreateIndex
CREATE INDEX "DrivingFeedback_driverId_idx" ON "DrivingFeedback"("driverId");

-- CreateIndex
CREATE INDEX "DrivingFeedback_vehicleId_idx" ON "DrivingFeedback"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_passengerToken_key" ON "Vehicle"("passengerToken");

-- AddForeignKey
ALTER TABLE "DrivingFeedback" ADD CONSTRAINT "DrivingFeedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrivingFeedback" ADD CONSTRAINT "DrivingFeedback_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrivingFeedback" ADD CONSTRAINT "DrivingFeedback_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrivingFeedback" ADD CONSTRAINT "DrivingFeedback_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

