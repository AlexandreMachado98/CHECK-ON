-- Tratativa das NCs: histórico de ações com fotos
CREATE TABLE "NcAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ncId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "text" TEXT,
    "photoUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NcAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NcAction_tenantId_ncId_createdAt_idx" ON "NcAction"("tenantId", "ncId", "createdAt");
ALTER TABLE "NcAction" ADD CONSTRAINT "NcAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NcAction" ADD CONSTRAINT "NcAction_ncId_fkey" FOREIGN KEY ("ncId") REFERENCES "NonConformity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
