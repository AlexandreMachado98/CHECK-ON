# Migrações (PostgreSQL / Neon)

O projeto passou de SQLite para PostgreSQL. As migrações antigas, escritas para SQLite, estão guardadas em `../legacy-sqlite-migrations` apenas como histórico e **não** são aplicadas.

A migração inicial (`20261110000000_init_postgres`) cria todo o schema atual. O deploy aplica as migrações com `npx prisma migrate deploy` (o container da API já faz isso ao iniciar), e o `npm run dev` da raiz faz o mesmo no banco local.

## Novas mudanças no schema

Edite `schema.prisma` e, em `apps/api` com o banco local ligado (`npm run dev` em outro terminal), rode:

```bash
npx prisma migrate dev --name <descricao>
```

Faça commit da pasta gerada. Nunca rode `migrate dev` contra o banco de produção.
