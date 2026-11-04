# Migrações (PostgreSQL / Neon)

O projeto passou de SQLite para PostgreSQL. As migrações antigas, escritas para SQLite, estão guardadas em `../legacy-sqlite-migrations` apenas como histórico e **não** são aplicadas.

## Criar a migração inicial (uma vez)

Com `DATABASE_URL` e `DIRECT_URL` apontando para um banco **vazio** do Neon (de preferência uma branch de desenvolvimento), rode em `apps/api`:

```bash
npx prisma migrate dev --name init_postgres
```

Isso gera a pasta `<data>_init_postgres` aqui dentro, a partir do `schema.prisma`. Faça commit dessa pasta. Daí em diante, o deploy aplica as migrações com `npx prisma migrate deploy` (o container da API já faz isso ao iniciar).

## Novas mudanças no schema

Edite `schema.prisma` e rode `npx prisma migrate dev --name <descricao>` contra a branch de desenvolvimento. Nunca rode `migrate dev` contra o banco de produção.
