-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "emExpiresAt" DATE,
ADD COLUMN     "emReleasedUntil" DATE;

-- CreateTable
CREATE TABLE "ElectromechanicalInspection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "performedAt" DATE NOT NULL,
    "expiresAt" DATE NOT NULL,
    "provider" TEXT,
    "reportNumber" TEXT,
    "notes" TEXT,
    "photoUrl" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectromechanicalInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectromechanicalRelease" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "until" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "byId" TEXT,
    "byName" TEXT,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectromechanicalRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ElectromechanicalInspection_tenantId_vehicleId_idx" ON "ElectromechanicalInspection"("tenantId", "vehicleId");

-- CreateIndex
CREATE INDEX "ElectromechanicalInspection_vehicleId_expiresAt_idx" ON "ElectromechanicalInspection"("vehicleId", "expiresAt");

-- CreateIndex
CREATE INDEX "ElectromechanicalRelease_tenantId_vehicleId_idx" ON "ElectromechanicalRelease"("tenantId", "vehicleId");

-- AddForeignKey
ALTER TABLE "ElectromechanicalInspection" ADD CONSTRAINT "ElectromechanicalInspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectromechanicalInspection" ADD CONSTRAINT "ElectromechanicalInspection_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectromechanicalRelease" ADD CONSTRAINT "ElectromechanicalRelease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectromechanicalRelease" ADD CONSTRAINT "ElectromechanicalRelease_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

