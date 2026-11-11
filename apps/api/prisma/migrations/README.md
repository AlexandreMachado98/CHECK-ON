# Migrações PostgreSQL

A migration inicial 20261111224000_init_postgres cria as 16 tabelas do CHECK-ON. Foi gerada do schema Prisma e validada em uma branch isolada do Neon.

## Deploy

Execute npx prisma migrate deploy em apps/api. O build da API no Vercel já executa esse comando. Ele cria as tabelas, mas não cria usuários. Para criar o administrador inicial, execute o seed com NODE_ENV=production e SEED_ADMIN_PASSWORD (12 caracteres ou mais).

## Novas alterações

Use npx prisma migrate dev --name <descricao> somente em uma branch de desenvolvimento. Versione a migration e aplique em produção com migrate deploy. As migrations antigas de SQLite ficam em ../legacy-sqlite-migrations e não são aplicadas.
