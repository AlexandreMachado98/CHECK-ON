BEGIN;
ALTER TABLE "MaintenancePlan" ADD COLUMN "intervalDays" INTEGER, ADD COLUMN "baseDate" DATE;
ALTER TABLE "MaintenanceService" ADD COLUMN "serviceDate" DATE, ADD COLUMN "workshop" TEXT, ADD COLUMN "costCents" INTEGER;
UPDATE "MaintenancePlan" p SET "baseDate" = s.day FROM
  (SELECT "planId", (MAX("recordedAt") AT TIME ZONE 'UTC' AT TIME ZONE 'America/Cuiaba')::date AS day FROM "MaintenanceService" GROUP BY "planId") s
  WHERE p.id = s."planId";
DROP INDEX "MaintenanceService_planId_mileageKm_key";
CREATE UNIQUE INDEX "MaintenanceService_planId_mileageKm_serviceDate_key" ON "MaintenanceService"("planId","mileageKm","serviceDate");
COMMIT;
