-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "allUnits" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "client" TEXT;

-- CreateTable
CREATE TABLE "UserUnit" (
    "userId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,

    CONSTRAINT "UserUnit_pkey" PRIMARY KEY ("userId","unitId")
);

-- CreateTable
CREATE TABLE "EmployeeUnit" (
    "employeeId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,

    CONSTRAINT "EmployeeUnit_pkey" PRIMARY KEY ("employeeId","unitId")
);

-- CreateTable
CREATE TABLE "TemplateUnit" (
    "templateId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,

    CONSTRAINT "TemplateUnit_pkey" PRIMARY KEY ("templateId","unitId")
);

-- CreateIndex
CREATE INDEX "UserUnit_unitId_idx" ON "UserUnit"("unitId");

-- CreateIndex
CREATE INDEX "EmployeeUnit_unitId_idx" ON "EmployeeUnit"("unitId");

-- CreateIndex
CREATE INDEX "TemplateUnit_unitId_idx" ON "TemplateUnit"("unitId");

-- AddForeignKey
ALTER TABLE "UserUnit" ADD CONSTRAINT "UserUnit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserUnit" ADD CONSTRAINT "UserUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeUnit" ADD CONSTRAINT "EmployeeUnit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeUnit" ADD CONSTRAINT "EmployeeUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateUnit" ADD CONSTRAINT "TemplateUnit_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateUnit" ADD CONSTRAINT "TemplateUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Dados existentes: nada muda para quem tem uma frente só ───────────────────
-- 1) Toda empresa passa a ter pelo menos uma frente ("Unidade principal").
INSERT INTO "Unit" ("id", "tenantId", "name", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t."id", 'Unidade principal', true, now(), now()
FROM "Tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "Unit" u WHERE u."tenantId" = t."id");

-- 2) Todo funcionário fica vinculado a todas as frentes da empresa dele (o motorista continua vendo tudo).
INSERT INTO "EmployeeUnit" ("employeeId", "unitId")
SELECT e."id", u."id"
FROM "Employee" e
JOIN "Unit" u ON u."tenantId" = e."tenantId"
ON CONFLICT DO NOTHING;

-- 3) Gestores e supervisores ficam vinculados a todas as frentes da empresa deles.
--    Administradores não precisam: veem todas as frentes sempre.
INSERT INTO "UserUnit" ("userId", "unitId")
SELECT usr."id", u."id"
FROM "User" usr
JOIN "Role" r ON r."id" = usr."roleId"
JOIN "Unit" u ON u."tenantId" = usr."tenantId"
WHERE r."name" IN ('GESTOR', 'SUPERVISOR')
ON CONFLICT DO NOTHING;

-- 4) Modelos de checklist existentes valem em todas as frentes (padrão da coluna allUnits).
