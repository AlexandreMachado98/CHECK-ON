# Database migrations

For a new database, run `npx prisma migrate deploy` from `apps/api`.

This repository previously created its schema without a migration history. Before deploying migrations to an existing database, make a database backup and mark the initial schema as already present, then apply the new migrations:

```bash
npx prisma migrate resolve --applied 20261102150000_initial
npx prisma migrate deploy
```

The baseline command records migration history only; it does not change or delete existing tables. Subsequent migrations add the virtual badge fields and training records, then persist the required-answer setting in checklist items.

`20261104120000_checklist_execution_sync` adiciona o `clientId` idempotente nas execuções, a reincidência de NCs (`occurrences`, `recurrentNcId`) e o vínculo direto da NC com veículo e item. NCs já existentes recebem veículo e item a partir da resposta de origem. A migração cria um índice único em `ChecklistAnswer(checklistId, itemId)`: se o banco tiver respostas duplicadas para o mesmo item num checklist, remova as duplicatas antes de aplicar.

`20261105090000_item_photo_requirement` adiciona `photoRequirement` aos itens do modelo (`NONE`, `ON_NON_COMPLIANCE` ou `ALWAYS`). Itens existentes ficam com `NONE`, ou seja, sem mudança de comportamento.
