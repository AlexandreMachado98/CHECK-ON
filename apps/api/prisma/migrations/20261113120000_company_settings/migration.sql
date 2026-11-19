-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "address" TEXT,
ADD COLUMN     "autoBlockCriticalNc" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "sessionsRevokedAt" TIMESTAMP(3);

