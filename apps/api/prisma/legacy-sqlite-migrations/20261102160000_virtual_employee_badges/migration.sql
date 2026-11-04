-- CreateTable
CREATE TABLE "EmployeeTraining" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeeTraining_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "matricula" TEXT,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "admissionDate" DATETIME,
    "departmentName" TEXT,
    "supervisorId" TEXT,
    "photoUrl" TEXT,
    "badgeToken" TEXT,
    "companyIntegrationDate" DATETIME,
    "companyIntegrationExpiresAt" DATETIME,
    "clientIntegrationDate" DATETIME,
    "clientIntegrationExpiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Employee_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("createdAt", "id", "isActive", "jobTitle", "matricula", "name", "tenantId", "updatedAt")
SELECT "createdAt", "id", "isActive", "jobTitle", "matricula", "name", "tenantId", "updatedAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";

-- Give existing records opaque, random verification tokens.
UPDATE "Employee" SET "badgeToken" = lower(hex(randomblob(32))) WHERE "badgeToken" IS NULL;

CREATE UNIQUE INDEX "Employee_badgeToken_key" ON "Employee"("badgeToken");
CREATE INDEX "Employee_tenantId_isActive_idx" ON "Employee"("tenantId", "isActive");
CREATE INDEX "Employee_tenantId_matricula_idx" ON "Employee"("tenantId", "matricula");
CREATE INDEX "Employee_supervisorId_idx" ON "Employee"("supervisorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EmployeeTraining_employeeId_expiresAt_idx" ON "EmployeeTraining"("employeeId", "expiresAt");
