-- CreateIndex
CREATE INDEX "Unit_tenantId_idx" ON "Unit"("tenantId");

-- CreateIndex
CREATE INDEX "Department_tenantId_idx" ON "Department"("tenantId");

-- CreateIndex
CREATE INDEX "Fleet_tenantId_idx" ON "Fleet"("tenantId");

-- CreateIndex
CREATE INDEX "Fleet_unitId_idx" ON "Fleet"("unitId");

-- CreateIndex
CREATE INDEX "Vehicle_tenantId_isActive_status_idx" ON "Vehicle"("tenantId", "isActive", "status");

-- CreateIndex
CREATE INDEX "Vehicle_fleetId_idx" ON "Vehicle"("fleetId");

-- CreateIndex
CREATE INDEX "Template_tenantId_idx" ON "Template"("tenantId");

-- CreateIndex
CREATE INDEX "TemplateCategory_templateId_idx" ON "TemplateCategory"("templateId");

-- CreateIndex
CREATE INDEX "TemplateItem_categoryId_idx" ON "TemplateItem"("categoryId");

-- CreateIndex
CREATE INDEX "Checklist_tenantId_completedAt_idx" ON "Checklist"("tenantId", "completedAt");

-- CreateIndex
CREATE INDEX "Checklist_tenantId_startedAt_idx" ON "Checklist"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "Checklist_driverId_idx" ON "Checklist"("driverId");

-- CreateIndex
CREATE INDEX "Checklist_templateId_idx" ON "Checklist"("templateId");

-- CreateIndex
CREATE INDEX "ChecklistAnswer_itemId_idx" ON "ChecklistAnswer"("itemId");

-- CreateIndex
CREATE INDEX "NonConformity_tenantId_status_idx" ON "NonConformity"("tenantId", "status");

-- CreateIndex
CREATE INDEX "NonConformity_tenantId_createdAt_idx" ON "NonConformity"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "NonConformity_vehicleId_idx" ON "NonConformity"("vehicleId");

-- CreateIndex
CREATE INDEX "NonConformity_itemId_idx" ON "NonConformity"("itemId");

