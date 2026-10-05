const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'apps/api/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const checklistModels = `// ---------------------------------------------------------
// DYNAMIC CHECKLISTS & INSPECTIONS
// ---------------------------------------------------------

model Template {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  categories  TemplateCategory[]
  checklists  Checklist[]
}

model TemplateCategory {
  id          String   @id @default(uuid())
  tenantId    String
  templateId  String
  template    Template @relation(fields: [templateId], references: [id], onDelete: Cascade)
  name        String
  order       Int      @default(0)

  items       TemplateItem[]
}

model TemplateItem {
  id          String   @id @default(uuid())
  tenantId    String
  categoryId  String
  category    TemplateCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  text        String
  type        String   @default("PASS_FAIL") // PASS_FAIL, TEXT, NUMBER, PHOTO
  isCritical  Boolean  @default(false)
  order       Int      @default(0)

  answers     ChecklistAnswer[]
}

// A Execução de um Checklist (A inspeção em si preenchida pelo motorista)
model Checklist {
  id          String   @id @default(uuid())
  tenantId    String
  tenant      Tenant   @relation("TenantToChecklist", fields: [tenantId], references: [id], onDelete: Cascade)
  templateId  String
  template    Template @relation(fields: [templateId], references: [id])
  vehicleId   String
  vehicle     Vehicle  @relation(fields: [vehicleId], references: [id])
  driverId    String
  driver      Employee @relation(fields: [driverId], references: [id])

  status      String   @default("IN_PROGRESS") // IN_PROGRESS, COMPLETED, SYNCED
  startedAt   DateTime @default(now())
  completedAt DateTime?
  latitude    Float?
  longitude   Float?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  answers     ChecklistAnswer[]
}

model ChecklistAnswer {
  id              String   @id @default(uuid())
  tenantId        String
  checklistId     String
  checklist       Checklist @relation(fields: [checklistId], references: [id], onDelete: Cascade)
  itemId          String
  item            TemplateItem @relation(fields: [itemId], references: [id])

  isCompliant     Boolean   // true = Conforme, false = Não Conforme
  textValue       String?
  numberValue     Float?
  photoUrl        String?
  observations    String?

  nonConformity   NonConformity?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model NonConformity {
  id              String   @id @default(uuid())
  tenantId        String
  tenant          Tenant   @relation("TenantToNC", fields: [tenantId], references: [id], onDelete: Cascade)
  answerId        String   @unique
  answer          ChecklistAnswer @relation(fields: [answerId], references: [id], onDelete: Cascade)

  status          String   @default("OPEN") // OPEN, IN_PROGRESS, RESOLVED, CLOSED
  severity        String   @default("MEDIUM") // LOW, MEDIUM, HIGH, CRITICAL
  notes           String?
  resolvedAt      DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
`;

// Substituir as linhas a partir de // ---------------------------------------------------------
// CHECKLISTS
const searchStr = `// ---------------------------------------------------------
// CHECKLISTS (Foundation models for now)
// ---------------------------------------------------------`;

const index = schema.indexOf(searchStr);
if (index !== -1) {
  schema = schema.substring(0, index) + checklistModels;
} else {
  console.log("Could not find checklist section to replace.");
}

// O model Tenant precisa das relations para os novos models que apontam pra ele diretamente.
// Tenant já tem \`checklists  Checklist[]\` (mas precisamos garantir os nomes).
schema = schema.replace('checklists  Checklist[]', 'checklists  Checklist[] @relation("TenantToChecklist")\\n  templates   Template[]\\n  ncs         NonConformity[] @relation("TenantToNC")');

fs.writeFileSync(schemaPath, schema);
console.log('Schema updated.');
