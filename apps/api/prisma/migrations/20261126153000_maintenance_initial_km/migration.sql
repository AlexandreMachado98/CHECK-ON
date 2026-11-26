ALTER TABLE "MaintenancePlan" ADD COLUMN "initialKm" INTEGER;
UPDATE "MaintenancePlan" p SET "initialKm" = p."baseKm"
WHERE NOT EXISTS (SELECT 1 FROM "MaintenanceService" s WHERE s."planId" = p.id);
