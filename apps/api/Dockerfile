# Imagem de produção da API CHECK-ON.
# Build a partir da RAIZ do repositório:  docker build -f apps/api/Dockerfile -t checkon-api .

FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Dependências e build ─────────────────────────────────────────────
FROM base AS build
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace=api --include-workspace-root
COPY apps/api apps/api
RUN npx --workspace=api prisma generate \
  && npm run build --workspace=api \
  && npm prune --omit=dev --workspace=api --include-workspace-root \
  && npx --workspace=api prisma generate \
  && mkdir -p apps/api/node_modules

# ── Execução ─────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3333
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 3333
# Aplica as migrações pendentes e sobe a API. Se a migração falhar, o container não sobe
# e o serviço de hospedagem mantém a versão anterior no ar.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
