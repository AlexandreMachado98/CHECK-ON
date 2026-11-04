-- Execução de checklist com sync idempotente, NC automática e reincidência.

-- AlterTable: idempotência do sync offline
ALTER TABLE "Checklist" ADD COLUMN "clientId" TEXT;
ALTER TABLE "Checklist" ADD COLUMN "syncedAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ChecklistAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "isCompliant" BOOLEAN NOT NULL,
    "textValue" TEXT,
    "numberValue" REAL,
    "photoUrl" TEXT,
    "observations" TEXT,
    "recurrentNcId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistAnswer_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistAnswer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TemplateItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChecklistAnswer_recurrentNcId_fkey" FOREIGN KEY ("recurrentNcId") REFERENCES "NonConformity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ChecklistAnswer" ("checklistId", "createdAt", "id", "isCompliant", "itemId", "numberValue", "observations", "photoUrl", "tenantId", "textValue", "updatedAt")
SELECT "checklistId", "createdAt", "id", "isCompliant", "itemId", "numberValue", "observations", "photoUrl", "tenantId", "textValue", "updatedAt" FROM "ChecklistAnswer";
DROP TABLE "ChecklistAnswer";
ALTER TABLE "new_ChecklistAnswer" RENAME TO "ChecklistAnswer";
CREATE INDEX "ChecklistAnswer_recurrentNcId_idx" ON "ChecklistAnswer"("recurrentNcId");
CREATE UNIQUE INDEX "ChecklistAnswer_checklistId_itemId_key" ON "ChecklistAnswer"("checklistId", "itemId");

CREATE TABLE "new_NonConformity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "itemId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "lastOccurrenceAt" DATETIME,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NonConformity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NonConformity_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "ChecklistAnswer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NonConformity_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NonConformity_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "TemplateItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Preenche veículo e item das NCs já existentes a partir da resposta de origem.
INSERT INTO "new_NonConformity" ("answerId", "createdAt", "id", "notes", "resolvedAt", "severity", "status", "tenantId", "updatedAt", "vehicleId", "itemId", "lastOccurrenceAt")
SELECT nc."answerId", nc."createdAt", nc."id", nc."notes", nc."resolvedAt", nc."severity", nc."status", nc."tenantId", nc."updatedAt",
       c."vehicleId", a."itemId", nc."createdAt"
FROM "NonConformity" nc
LEFT JOIN "ChecklistAnswer" a ON a."id" = nc."answerId"
LEFT JOIN "Checklist" c ON c."id" = a."checklistId";
DROP TABLE "NonConformity";
ALTER TABLE "new_NonConformity" RENAME TO "NonConformity";
CREATE UNIQUE INDEX "NonConformity_answerId_key" ON "NonConformity"("answerId");
CREATE INDEX "NonConformity_tenantId_vehicleId_itemId_status_idx" ON "NonConformity"("tenantId", "vehicleId", "itemId", "status");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Checklist_tenantId_clientId_key" ON "Checklist"("tenantId", "clientId");
CREATE INDEX "Checklist_tenantId_vehicleId_idx" ON "Checklist"("tenantId", "vehicleId");
