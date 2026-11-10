#!/usr/bin/env node
// Sobe o CHECK-ON inteiro em desenvolvimento com um comando: `npm run dev`.
//
// 1. Cria apps/api/.env e apps/web/.env.local se não existirem.
// 2. Se o banco configurado for o local embutido (porta 54329), liga um PostgreSQL
//    que roda de dentro do node_modules — sem Docker e sem instalar nada.
//    Os dados ficam em .checkon-db/ e sobrevivem entre execuções.
// 3. Gera o Prisma Client, aplica as migrações e roda o seed.
// 4. Sobe a API (http://localhost:3333) e o painel (http://localhost:3000).
//
// Para usar outro banco (Docker, Neon...), basta trocar DATABASE_URL/DIRECT_URL em apps/api/.env.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(root, 'apps', 'api');
const webDir = join(root, 'apps', 'web');
const isWindows = process.platform === 'win32';

const EMBEDDED_PORT = 54329;
const EMBEDDED_URL = `postgresql://checkon:checkon_secret@localhost:${EMBEDDED_PORT}/checkondb`;

const log = (msg) => console.log(`\x1b[32m[check-on]\x1b[0m ${msg}`);
const fail = (msg) => {
  console.error(`\n\x1b[31m[check-on] ERRO:\x1b[0m ${msg}\n`);
  process.exit(1);
};

// ── Pré-requisitos ──────────────────────────────────────────────
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 20) fail(`Node ${process.versions.node} é antigo demais. Instale o Node 20 ou mais novo (https://nodejs.org).`);
if (!existsSync(join(root, 'node_modules', '.bin'))) fail('Dependências não instaladas. Rode primeiro, na pasta do projeto:  npm install');

// ── Arquivos de ambiente ────────────────────────────────────────
const apiEnv = join(apiDir, '.env');
if (!existsSync(apiEnv)) {
  writeFileSync(
    apiEnv,
    [
      '# Criado automaticamente por `npm run dev` (banco PostgreSQL embutido).',
      `DATABASE_URL="${EMBEDDED_URL}"`,
      `DIRECT_URL="${EMBEDDED_URL}"`,
      'CORS_ORIGINS=http://localhost:3000',
      'PORT=3333',
      'PUBLIC_API_URL=http://localhost:3333',
      'STORAGE_DRIVER=local',
      'UPLOADS_DIRECTORY=uploads',
      '',
    ].join('\n'),
  );
  log('Criado apps/api/.env');
}
const webEnv = join(webDir, '.env.local');
if (!existsSync(webEnv)) {
  copyFileSync(join(webDir, '.env.example'), webEnv);
  log('Criado apps/web/.env.local');
}

const databaseUrl = /^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m.exec(readFileSync(apiEnv, 'utf8'))?.[1] ?? '';
const useEmbedded = databaseUrl.includes(`:${EMBEDDED_PORT}/`);

// ── Execução de comandos ────────────────────────────────────────
const children = [];

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: isWindows });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} saiu com código ${code}`))));
  });
}

function startService(name, color, args, cwd) {
  // Fora do Windows, cada serviço vira um grupo de processos para encerrar npm + nest/next juntos.
  const child = spawn('npm', args, { cwd, shell: isWindows, detached: !isWindows, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream, out) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) out.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`\n${prefix}parou (código ${code}). Veja a mensagem acima.`);
      shutdown(1);
    }
  });
  children.push(child);
}

let pg;
let shuttingDown = false;

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('Encerrando...');
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (isWindows) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    }
  }
  if (pg) await pg.stop().catch(() => {});
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// ── Banco embutido ──────────────────────────────────────────────
async function startEmbeddedPostgres() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const dataDir = join(root, '.checkon-db');
  pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'checkon',
    password: 'checkon_secret',
    port: EMBEDDED_PORT,
    persistent: true,
    // O PostgreSQL não roda como root; em containers/WSL como root, cria um usuário próprio.
    createPostgresUser: typeof process.getuid === 'function' && process.getuid() === 0,
    onLog: () => {},
    onError: (e) => {
      if (!shuttingDown) console.error(String(e).trim());
    },
  });

  if (!existsSync(join(dataDir, 'PG_VERSION'))) {
    log('Preparando o banco PostgreSQL local (só na primeira vez)...');
    await pg.initialise();
  }
  try {
    await pg.start();
  } catch (e) {
    fail(
      `Não consegui ligar o banco local na porta ${EMBEDDED_PORT}.\n` +
        '  - Se já existe outro `npm run dev` aberto, feche-o antes.\n' +
        '  - Se o problema continuar, apague a pasta .checkon-db e tente de novo.\n' +
        `  Detalhe: ${e?.message ?? e}`,
    );
  }
  await pg.createDatabase('checkondb').catch(() => {}); // já existe
  log(`Banco local no ar (porta ${EMBEDDED_PORT}).`);
}

// ── Fluxo principal ─────────────────────────────────────────────
try {
  if (useEmbedded) await startEmbeddedPostgres();
  else log('Usando o banco definido em apps/api/.env.');

  log('Gerando o Prisma Client...');
  await run('npx', ['prisma', 'generate'], apiDir);

  log('Aplicando migrações...');
  try {
    await run('npx', ['prisma', 'migrate', 'deploy'], apiDir);
  } catch {
    fail(
      'As migrações falharam.\n' +
        '  - Se a mensagem acima for P1001 (Can\'t reach database server), o banco de apps/api/.env não está ligado.\n' +
        '  - Se for P3005 (database schema is not empty), esse banco foi criado antes sem migrações.\n' +
        '    Mais fácil: apague apps/api/.env e rode `npm run dev` de novo para usar o banco embutido.',
    );
  }

  log('Carregando dados de exemplo...');
  await run('npx', ['prisma', 'db', 'seed'], apiDir);

  log('Subindo API e painel...');
  startService('api', 36, ['run', 'start:dev'], apiDir);
  startService('web', 35, ['run', 'dev'], webDir);

  console.log(
    '\n  Painel:  http://localhost:3000' +
      '\n  API:     http://localhost:3333/health' +
      '\n  Login:   gestor@alpha.com / admin123  (ou admin@checkon.com / admin123)' +
      '\n  Ctrl+C para parar.\n',
  );
} catch (e) {
  console.error(e?.message ?? e);
  await shutdown(1);
}
