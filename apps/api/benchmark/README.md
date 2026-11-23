# Benchmark da API (frota de 250 veículos)

Mede velocidade, carga e segurança da API com uma empresa do tamanho de um cliente grande:
3 frentes de trabalho, 6 frotas, 250 veículos/máquinas, 300 motoristas, checklists de 40 e 30
itens e 90 dias de histórico (22.500 inspeções, ~790 mil respostas, ~15 mil NCs).

Roda só em banco **local** (`checkon_bench`). Não aponte para produção: o teste cria e apaga dados
e dispara centenas de envios por minuto.

## Como rodar

```bash
cd apps/api && npm run build
./benchmark/run-all.sh
```

Partes isoladas (com a API e a massa já prontas): `node bench.mjs latencia`, `pico`, `portal`,
`duplicado`; `node security.mjs` (rode `./unlock.sh` antes: o próprio teste bloqueia logins).

## O que cada arquivo faz

| Arquivo | O quê |
| --- | --- |
| `reset.sh` | Recria o banco `checkon_bench` (migrações + super admin). |
| `start-api.sh` | Sobe a API compilada na porta 3499 com `api.env.example`. |
| `setup.mjs` | Cria a empresa pela API (o mesmo caminho do portal) e grava `setup.json`. |
| `access.mjs` | Dá acesso ao aplicativo para os 300 motoristas. |
| `history.sql` | 90 dias de inspeções, respostas e NCs direto no banco. |
| `verify.mjs` | Confere as contagens da API (NCs por inspeção, por veículo, reincidências, busca) contra o banco. |
| `bench.mjs` | Tempo de resposta (1 usuário), pico de 50/200 motoristas, 60 s de uso contínuo e reenvio duplicado. Resultados em `resultados/`. |
| `security.mjs` | Isolamento entre empresas, token adulterado, perfis, bloqueio de login, arquivos e envios inválidos. |

### Com fotos

```bash
python3 make-photos.py fotos          # 12 fotos de 1600 px, JPEG 70% (~377 KB, como as do app)
node bench-fotos.mjs                  # 1, 4 e 40 fotos por inspeção, 50 e 200 motoristas + queda no meio do envio
node bench-fotos.mjs 40 --motoristas=200
node fotos-portal-setup.mjs           # 3 inspeções (1, 4 e 40 fotos) no BEN0248, para abrir no portal e gerar o PDF
```

O cenário de 40 fotos com 200 motoristas grava ~3 GB em `UPLOADS_DIRECTORY` (`/tmp/checkon-bench-uploads`).

### Banco longe da API (como em produção)

```bash
node latency-proxy.mjs 6432 25        # +25 ms em cada sentido = 50 ms por ida e volta
# suba a API com DATABASE_URL=...localhost:6432/checkon_bench?connection_limit=5
node sync-latency.mjs                 # 10 envios seguidos e 50 motoristas ao mesmo tempo
```

O resultado de referência está em [`docs/BENCHMARK.md`](../../../docs/BENCHMARK.md).
