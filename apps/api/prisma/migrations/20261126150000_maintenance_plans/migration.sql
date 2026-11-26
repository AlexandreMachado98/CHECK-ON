CREATE TABLE "MaintenancePlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intervalKm" INTEGER NOT NULL,
    "warningKm" INTEGER NOT NULL,
    "baseKm" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "MaintenancePlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaintenanceService" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "mileageKm" INTEGER NOT NULL,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceService_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaintenancePlan_tenantId_archivedAt_idx" ON "MaintenancePlan"("tenantId", "archivedAt");
CREATE INDEX "MaintenancePlan_vehicleId_idx" ON "MaintenancePlan"("vehicleId");
CREATE UNIQUE INDEX "MaintenanceService_planId_mileageKm_key" ON "MaintenanceService"("planId", "mileageKm");

ALTER TABLE "MaintenancePlan" ADD CONSTRAINT "MaintenancePlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenancePlan" ADD CONSTRAINT "MaintenancePlan_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceService" ADD CONSTRAINT "MaintenanceService_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MaintenancePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
