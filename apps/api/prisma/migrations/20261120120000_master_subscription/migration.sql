-- Assinatura da empresa (controlada pelo DDS Master)
ALTER TABLE "Tenant" ADD COLUMN "billingCycle" TEXT NOT NULL DEFAULT 'MENSAL';
ALTER TABLE "Tenant" ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "graceDays" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Tenant" ADD COLUMN "masterNotes" TEXT;

-- Histórico das ações do DDS Master
CREATE TABLE "MasterAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MasterAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MasterAuditLog_tenantId_createdAt_idx" ON "MasterAuditLog"("tenantId", "createdAt");
CREATE INDEX "MasterAuditLog_createdAt_idx" ON "MasterAuditLog"("createdAt");
ALTER TABLE "MasterAuditLog" ADD CONSTRAINT "MasterAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
