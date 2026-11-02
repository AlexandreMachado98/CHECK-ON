-- Persist the required/optional setting configured in the template builder.
ALTER TABLE "TemplateItem"
ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT true;
