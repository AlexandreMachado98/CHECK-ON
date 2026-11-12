-- CreateTable
CREATE TABLE "AdminAccessLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAccessLog_tenantId_createdAt_idx" ON "AdminAccessLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAccessLog_createdAt_idx" ON "AdminAccessLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AdminAccessLog" ADD CONSTRAINT "AdminAccessLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAccessLog" ADD CONSTRAINT "AdminAccessLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

