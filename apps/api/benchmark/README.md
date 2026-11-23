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

O resultado de referência está em [`docs/BENCHMARK.md`](../../../docs/BENCHMARK.md).
