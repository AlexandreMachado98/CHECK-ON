-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3),
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "Tenant"("code");


-- Código para as empresas que já existem: letras e números do nome (sem acento), até 10 caracteres.
-- Nomes que gerariam o mesmo código ganham um número no fim (GAMA, GAMA2...).
WITH base AS (
  SELECT id,
         COALESCE(NULLIF(UPPER(LEFT(regexp_replace(
           translate("name", 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
           '[^A-Za-z0-9]', '', 'g'), 10)), ''), 'EMPRESA') AS raw,
         "createdAt"
  FROM "Tenant"
  WHERE "code" IS NULL
), numbered AS (
  SELECT id, raw, ROW_NUMBER() OVER (PARTITION BY raw ORDER BY "createdAt") AS n FROM base
)
UPDATE "Tenant" t
SET "code" = CASE WHEN numbered.n = 1 THEN numbered.raw ELSE LEFT(numbered.raw, 8) || numbered.n END
FROM numbered
WHERE t.id = numbered.id;
