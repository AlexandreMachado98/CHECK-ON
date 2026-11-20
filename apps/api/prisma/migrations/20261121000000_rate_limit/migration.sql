-- Limite de tentativas compartilhado entre todas as instâncias da API (antes ficava só na memória
-- de cada instância e, na Vercel, cada instância contava separado).
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");
