-- "Não se aplica" nas respostas do checklist
ALTER TABLE "ChecklistAnswer" ADD COLUMN "notApplicable" BOOLEAN NOT NULL DEFAULT false;
