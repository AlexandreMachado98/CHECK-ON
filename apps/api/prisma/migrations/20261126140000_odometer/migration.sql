-- Km do veículo no checklist: o modelo escolhe se pede; cada inspeção guarda a leitura.
ALTER TABLE "Template" ADD COLUMN "askOdometer" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Checklist" ADD COLUMN "odometerKm" INTEGER;
