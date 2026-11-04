-- Evidência fotográfica obrigatória por item do modelo de checklist.
ALTER TABLE "TemplateItem" ADD COLUMN "photoRequirement" TEXT NOT NULL DEFAULT 'NONE';
