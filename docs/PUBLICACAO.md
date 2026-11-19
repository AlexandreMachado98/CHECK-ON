# Publicação do CHECK-ON

| Parte | Onde | Observação |
| --- | --- | --- |
| Painel web (`apps/web`) | Vercel | Next.js, sem servidor próprio |
| API (`apps/api`) | Vercel (services), funções em **São Paulo (`gru1`)** | Alternativa: Render (ver abaixo) |
| Banco | Neon (PostgreSQL) | Região **AWS sa-east-1 (São Paulo)**, a mesma da API |
| Fotos | Armazenamento compatível com S3 (ex.: Cloudflare R2) | Nunca no banco nem no disco da API |

A API e o banco precisam ficar na mesma região: uma inspeção faz várias consultas ao banco, e cada uma pagaria a distância entre regiões. Com a API nos EUA e o banco em São Paulo, cada consulta levava ~113 ms, contra poucos ms na mesma região.

## 1. Preparar o repositório (na sua máquina, uma vez)

```bash
# Na raiz do repositório: atualiza o package-lock.json com as novas dependências
npm install

# Remove o banco SQLite antigo do histórico do Git, caso ainda esteja rastreado
git rm --cached apps/api/prisma/dev.db 2>/dev/null || true
```

Faça commit do `package-lock.json`. Sem isso o build do Docker falha no `npm ci`.

## 2. Banco no Neon

1. Crie um projeto na região **AWS South America East 1 (São Paulo)**, com um banco chamado `checkon`.
2. Crie também uma branch `dev` para desenvolvimento e migrações.
3. Em **Connect**, copie duas connection strings de cada branch:
   - **com pooling** (host com `-pooler`): vai em `DATABASE_URL`. Acrescente `&pgbouncer=true&connection_limit=5`;
   - **direta** (sem `-pooler`): vai em `DIRECT_URL`.
4. Em `apps/api`, copie `.env.example` para `.env` e preencha com as URLs da branch **dev**.
5. Gere a migração inicial do PostgreSQL (uma única vez) e faça commit da pasta criada:

```bash
cd apps/api
npx prisma migrate dev --name init_postgres
npx prisma db seed   # dados de exemplo, só na branch dev
```

## 3. Armazenamento das fotos (exemplo com Cloudflare R2)

1. Crie um bucket, por exemplo `checkon-fotos`.
2. Ative o acesso público por um domínio próprio (ex.: `fotos.seudominio.com.br`) ou pela URL pública do R2. Esse endereço vai em `STORAGE_PUBLIC_URL`.
3. Crie um token de API com permissão de leitura e escrita **só nesse bucket**. Anote o Access Key ID, o Secret e o endpoint (`https://<account_id>.r2.cloudflarestorage.com`).

## 4. API no Render (alternativa)

> O Render não tem região em São Paulo. Com o banco em `sa-east-1`, a API no Render pagaria ~110 ms por consulta. Prefira a publicação na Vercel (seção "API e painel juntos na Vercel"), que roda em `gru1`.

1. **New > Blueprint** e selecione o repositório. O `render.yaml` já define o serviço Docker, a região, o health check e gera um `JWT_SECRET` aleatório.
2. Preencha as variáveis marcadas como pendentes:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | URL com pooling da branch **main** do Neon |
| `DIRECT_URL` | URL direta da branch **main** |
| `CORS_ORIGINS` | Domínio do painel, ex.: `https://checkon.vercel.app` (pode listar vários, separados por vírgula) |
| `PUBLIC_API_URL` | Endereço do serviço no Render, ex.: `https://checkon-api.onrender.com` |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `STORAGE_PUBLIC_URL` | Dados do passo 3 |

3. No primeiro deploy, o container roda `prisma migrate deploy` e cria as tabelas no banco de produção. Se faltar alguma variável obrigatória, a API não sobe e o log diz qual está faltando.
4. Crie o super admin de produção a partir da sua máquina, apontando para a branch **main**:

```bash
cd apps/api
NODE_ENV=production SEED_ADMIN_PASSWORD='uma-senha-forte-de-12+' \
DATABASE_URL='<url main com pooling>' DIRECT_URL='<url main direta>' npx prisma db seed
```

5. Teste: `https://<sua-api>/health` deve responder `{"status":"ok","database":"ok",...}`.

## 5. Painel na Vercel

1. **Add New > Project** e importe o repositório.
2. **Root Directory:** `apps/web`. O framework (Next.js) é detectado sozinho.
3. Variáveis de ambiente:
   - `NEXT_PUBLIC_API_URL` = endereço da API no Render
   - `NEXT_PUBLIC_APP_URL` = endereço do próprio painel na Vercel
4. Depois do primeiro deploy, confira se o domínio da Vercel está em `CORS_ORIGINS` no Render. Se não estiver, o login do painel falha com erro de CORS.

## Checklist depois de publicar

- [ ] `/health` da API responde `ok`
- [ ] Login no painel funciona
- [ ] Upload de foto de funcionário aparece (confirma o armazenamento S3)
- [ ] Ninguém consegue entrar com `admin123` em produção
- [ ] Backups: o Neon guarda o histórico conforme o plano. Antes de receber clientes, passe para um plano pago com restauração para um ponto no tempo

## Alternativa: API e painel juntos na Vercel (services)

O `vercel.json` da raiz publica os dois apps num único projeto e num único domínio:

| Serviço | Pasta | Caminho público |
| --- | --- | --- |
| `web` | `apps/web` | `/` |
| `api` | `apps/api` | `/api` (o NestJS registra o prefixo quando `VERCEL=1`) |

1. No projeto da Vercel, deixe **Root Directory** vazio (raiz do repositório). Com `apps/api` ou `apps/web` ali, o `vercel.json` é ignorado.
   - O `vercel.json` fixa as funções em **`gru1` (São Paulo)**, junto do banco. Confira também em **Settings > Functions > Function Region**: deve aparecer São Paulo (`gru1`). Se o banco mudar de região, mude as duas coisas juntas.
2. Em **Settings > Environment Variables** (valem para os dois serviços):

| Variável | Valor |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | URLs do Neon. Em **Preview**, use as da branch `dev`: o build roda `prisma migrate deploy` |
| `JWT_SECRET` | 32+ caracteres (`openssl rand -base64 48`) |
| `CORS_ORIGINS` | O domínio do projeto, ex.: `https://checkon.vercel.app` |
| `PUBLIC_API_URL` | `https://<dominio>/api` |
| `S3_*`, `STORAGE_PUBLIC_URL` | Armazenamento das fotos (o disco das funções da Vercel não é persistente) |
| `NEXT_PUBLIC_API_URL` | **Não defina.** O painel usa `/api` na mesma origem |

3. O app mobile usa `https://<dominio>/api` como endereço base. As rotas são as mesmas de `docs/API_EXECUCAO_CHECKLIST.md`.
4. Fotos: até 4 MB. A Vercel recusa corpos de requisição acima de 4,5 MB.
5. Teste: `https://<dominio>/api/health` deve responder `{"status":"ok","database":"ok",...}`. O `latencyMs` deve ficar em poucos ms; perto de 100 ms indica API e banco em regiões diferentes.

Localmente, `vercel dev` na raiz sobe os dois serviços com o mesmo roteamento.

## Recuperação de senha por e-mail (Neon Auth)

"Esqueci minha senha" usa o **Neon Auth (Managed Better Auth)** só para enviar e conferir o código por e-mail. O login continua sendo o do CHECK-ON.

1. No Neon (projeto → **Better Auth**), ative o Auth na branch de produção.
2. Em **Settings → Better Auth**: deixe ligados **Sign-up with Email** e **Sign-in with Email**, e **desligado** "Verify at Sign-up".
3. Em **Trusted domains**, adicione o domínio do painel (ex.: `https://check-on-mu.vercel.app`).
4. Na Vercel, crie a variável `NEON_AUTH_URL` com a **Auth URL** da branch (ex.: `https://ep-...neonauth....aws.neon.tech/neondb/auth`) e publique de novo.
   - Opcional: `NEON_AUTH_ORIGIN`. Se não for definida, usa o primeiro domínio de `CORS_ORIGINS`.
5. Produção: em **Settings → Better Auth → Email**, configure um SMTP próprio. O remetente padrão do Neon tem limite de envio.
6. Ao terminar os testes, desligue **Allow Localhost**.

Sem `NEON_AUTH_URL`, a tela "Esqueci minha senha" avisa para pedir uma senha nova à empresa.


## Integração com o DDS Master (assinaturas)

O DDS Master controla os clientes do CHECK-ON: assinatura (teste, mensal ou anual) e vencimento, código de acesso do aplicativo, suspensão e senha do administrador da empresa. Ele chama a API do CHECK-ON em `/api/master/*`, servidor a servidor.

1. Gere uma chave aleatória com 32 caracteres ou mais. Exemplo no PowerShell: `-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 48 | % {[char]$_})`.
2. Na Vercel do **CHECK-ON**, crie a variável `CHECKON_MASTER_TOKEN` com essa chave e publique de novo.
3. Na Vercel do **DDS Master**, use **a mesma chave** e o endereço `https://<dominio-do-check-on>/api`.

Teste: `GET /api/master/ping` com o cabeçalho `Authorization: Bearer <chave>` deve responder `{"ok":true,...}`. Sem a variável, a API responde 503 e a integração fica desligada. Dez chaves erradas seguidas, vindas do mesmo IP, bloqueiam esse IP por 15 minutos.

**Regras da assinatura:**
- **Sem vencimento:** a empresa nunca é bloqueada. Esse é o caso das empresas criadas antes da integração e da empresa da plataforma.
- **Até o vencimento:** tudo funciona. Nos últimos 7 dias, o portal mostra um aviso.
- **Carência** (padrão de 5 dias após o vencimento): tudo funciona, e o portal mostra um aviso em vermelho.
- **Vencida:** o login no portal e no aplicativo é recusado e os acessos abertos caem em até 30 segundos. Nada é apagado: as inspeções guardadas no celular são enviadas depois da renovação.
- **Suspensa** (no Master): o bloqueio é imediato.
- O super admin continua entrando em qualquer empresa pelo "Acessar empresa".
