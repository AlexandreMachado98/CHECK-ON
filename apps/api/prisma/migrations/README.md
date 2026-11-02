# Database migrations

For a new database, run `npx prisma migrate deploy` from `apps/api`.

This repository previously created its schema without a migration history. Before deploying migrations to an existing database, make a database backup and mark the initial schema as already present, then apply the new migrations:

```bash
npx prisma migrate resolve --applied 20261102150000_initial
npx prisma migrate deploy
```

The baseline command records migration history only; it does not change or delete existing tables. Subsequent migrations add the virtual badge fields and training records, then persist the required-answer setting in checklist items.
