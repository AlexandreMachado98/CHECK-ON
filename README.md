# CHECK-ON

Plataforma de checklists e gestão de frotas: API em NestJS (`apps/api`) e painel em Next.js (`apps/web`).

## Rodar localmente

Requisito: **Node.js 20 ou mais novo** ([nodejs.org](https://nodejs.org)). Não precisa de Docker nem de PostgreSQL instalado.

```bash
npm install
npm run dev
```

O `npm run dev`:

1. cria `apps/api/.env` e `apps/web/.env.local`, se ainda não existirem;
2. liga um PostgreSQL embutido na porta `54329`, com os dados guardados em `.checkon-db/`;
3. gera o Prisma Client, aplica as migrações e carrega os dados de exemplo;
4. sobe a API e o painel.

Depois, abra:

- Painel: http://localhost:3000
- API: http://localhost:3333/health

Para entrar, use `gestor@alpha.com` / `admin123` (gestor) ou `admin@checkon.com` / `admin123` (super admin). Para parar, use **Ctrl+C**.

### Problemas comuns

- **"Dependências não instaladas"**: rode `npm install` na pasta raiz do projeto, não dentro de `apps/`.
- **Porta 3000 ou 3333 em uso**: feche outro `npm run dev` ou servidor que esteja aberto.
- **Quer zerar o banco**: pare o `npm run dev`, apague a pasta `.checkon-db/` e rode de novo.
- **Quer usar outro banco** (Docker, Neon): troque `DATABASE_URL` e `DIRECT_URL` em `apps/api/.env`. Com Docker, rode `docker compose up -d` e use `postgresql://checkon:checkon_secret@localhost:5432/checkondb`.

## Testes

```bash
npm test --workspace=api
```

## Publicação

Veja [docs/PUBLICACAO.md](docs/PUBLICACAO.md).
