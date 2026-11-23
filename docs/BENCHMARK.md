# Benchmark: frota de 250 veículos e máquinas

Data: 23/11/2026. Como repetir: [`apps/api/benchmark`](../apps/api/benchmark/README.md) (`./run-all.sh`, ~2,5 min).

## Cenário

Uma empresa do porte do cliente-alvo, criada pela própria API (o mesmo caminho do portal):

| | |
| --- | --- |
| Frentes de trabalho | 3 (Mina Norte, Porto, Rodovia), 6 frotas |
| Veículos e máquinas | 250 |
| Motoristas com acesso ao app | 300 |
| Checklists | 2 (40 e 30 itens), com itens críticos e foto obrigatória em NC |
| Histórico | 90 dias, 1 inspeção por veículo por dia: **22.500 inspeções, ~790 mil respostas, ~15 mil NCs** |
| Tamanho do banco | ~420 MB |

Ambiente: 1 processo da API (build de produção), PostgreSQL 16 local, 4 vCPUs. Em produção
(Vercel + Neon) cada consulta ganha a latência de rede até o banco (alguns ms), a primeira chamada
depois de um tempo parado é mais lenta (partida a frio), e a API escala em várias instâncias: a carga
alta tende a ser **melhor** que aqui, onde um único processo atende tudo.

## Resultados

### 1 pessoa usando (30 repetições, tempo de resposta da API)

| Operação | p50 | p95 |
| --- | ---: | ---: |
| Motorista entra no app | 8 ms | 11 ms |
| App baixa os dados (≈83 veículos da frente, ~95 KB) | 33 ms | 41 ms |
| Envio de 1 inspeção de 40 itens | 72 ms | 84 ms |
| Painel (resumo) | 4 ms | 7 ms |
| Relatório do painel: 30 dias (padrão) / todo o histórico | 52 / 72 ms | — |
| Lista de inspeções (1ª página / página 400) | 12 / 19 ms | 14 / 23 ms |
| Busca por placa | 53 ms | 72 ms |
| Detalhe da inspeção (40 respostas) | 9 ms | 12 ms |
| Lista de NCs ativas | 23 ms | 28 ms |
| Veículos (250) / colaboradores (300) | 11 / 30 ms | 14 / 38 ms |
| Login do portal (senha com bcrypt, proposital) | 73 ms | 77 ms |

### Pico da manhã (todos ao mesmo tempo: entrar + baixar dados + enviar inspeção)

| Motoristas simultâneos | Erros | Pior envio (p99) | Todos prontos em |
| ---: | ---: | ---: | ---: |
| 50 | 0 | 0,8 s | 1,7 s |
| 200 | 0 | 2,2 s | 6,4 s |

### 60 s de uso contínuo (20 gestores no portal + 50 motoristas enviando sem parar)

- **2.416 inspeções gravadas no minuto**, 0 erros. A frota inteira faz ~250 por dia.
- Portal sob essa pressão: p95 entre 0,6 s (painel, detalhe) e 1,0 s (relatório, listas).

### Confiabilidade do envio

- Mesma inspeção reenviada 20× ao mesmo tempo (internet ruim): **gravada 1 vez**, as outras 19
  respondem "duplicada". O app pode reenviar sem medo.
- Contagens da API conferidas contra o banco (NCs por inspeção, por veículo, reincidências, busca):
  iguais.

### Segurança (28/28)

- **Isolamento entre empresas:**
  - Uma empresa vizinha não lista, abre, altera nem exclui nada da frota de 250.
  - Também não recebe os veículos dela no app nem consegue enviar inspeção para eles.
  - Testado por id direto na URL.
- **Isolamento entre frentes:** suíte própria, 62/62.
- **Sessão e perfis:**
  - Token adulterado é recusado.
  - Motorista não entra no portal nem nas rotas do super admin.
- **Senha errada:**
  - Bloqueia a conta após 5 erros (15 min) e a rede após ~30.
  - As outras redes seguem entrando.
- **Entradas maliciosas:** busca com SQL malicioso e id malicioso não vazam nada e não geram erro interno.
- **Arquivos e envios recusados:**
  - foto acima do limite;
  - arquivo que não é imagem disfarçado de .jpg;
  - HTML;
  - campos não previstos;
  - lote de 500 inspeções;
  - inspeção com data no futuro.

## Com fotos (1, 4 e 40 fotos por inspeção)

As fotos de teste têm o mesmo formato das do app: 1600 px, JPEG 70%, média de **377 KB**
(314 a 435 KB). Cada motorista entra, baixa os dados, envia as fotos uma a uma (como o app) e
depois a inspeção de 40 itens. Armazenamento local (em produção é S3, com a ida até lá a mais).

### Envio: todos ao mesmo tempo

| Fotos por inspeção | Motoristas | Fotos enviadas | Erros | Cada foto (p95) | Cada motorista (p95) | Todos prontos em |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 50 | 50 | 0 | 0,5 s | 4,7 s | 4,8 s |
| 1 | 200 | 200 | 0 | 1,3 s | 7,8 s | 7,9 s |
| 4 | 50 | 200 | 0 | 0,3 s | 2,2 s | 2,3 s |
| 4 | 200 | 800 | 0 | 1,4 s | 9,2 s | 9,3 s |
| 40 | 50 | 2.000 | 0 | 0,2 s | 6,3 s | 6,3 s |
| 40 | 200 | 8.000 | **0** (antes: 9 inspeções falhavam) | 0,6 s | 24 s | 24 s |

- A API gravou ~120 MB/s de fotos e usou no máximo ~550 MB de memória (200 envios simultâneos).
- **Internet caindo no meio da foto:**
  - 20 envios cortados ao meio não deixaram arquivo pela metade.
  - A API seguiu no ar.
  - A nova tentativa subiu a foto, e a inspeção reenviada 3× foi gravada 1 vez.

### Tempo de envio no celular (estimativa pela rede, não medida)

A rede do celular é o que mais pesa. Subida em 4G fraco (1 Mbps) / bom (5 Mbps):

| Fotos por inspeção | Dados enviados | 4G fraco | 4G bom |
| ---: | ---: | ---: | ---: |
| 1 | ~0,4 MB | ~3 s | <1 s |
| 4 | ~1,5 MB | ~12 s | ~2 s |
| 40 | ~15 MB | **~2 min** | ~24 s |

O app envia em segundo plano e guarda tudo se a conexão cair, então o motorista não fica esperando.
Com 40 fotos, porém, a inspeção pode levar minutos para chegar ao portal num pátio com sinal ruim.

### Armazenamento (250 veículos, 1 inspeção por veículo por dia)

| Fotos por inspeção | Por mês | Em 1 ano (acumulado) |
| ---: | ---: | ---: |
| 1 | ~2,8 GB | ~33 GB |
| 4 | ~11 GB | ~135 GB |
| 40 | ~110 GB | **~1,3 TB** |

Só as fotos. O banco (respostas, NCs) fica em ~420 MB para 90 dias, igual com ou sem fotos.

### Portal e PDF

| Fotos na inspeção | Abrir o detalhe | Fotos baixadas ao rolar tudo | PDF: tempo / tamanho / páginas |
| ---: | ---: | ---: | ---: |
| 1 | 0,1 s | 0,3 MB | 0,1 s / 151 KB / 3 |
| 4 | 0,1 s | 1,3 MB | 0,1 s / 483 KB / 3 |
| 40 | 0,2 s | **14,6 MB** | 0,8 s / 1,5 MB / 10 |

O PDF reduz as fotos para 900 px, por isso fica leve. Já o detalhe mostra miniaturas pequenas, mas
carrega a foto inteira (1600 px), e uma inspeção com 40 fotos baixa ~15 MB no navegador do gestor.

### Envio com o banco longe da API (como em produção)

O envio repetia uma ida ao banco por item.

- **O problema:** com a API na Vercel e o banco no Neon a dezenas de ms de distância, isso segurava a conexão por segundos. Testado com um intermediário que atrasa cada ida e volta em 50 ms e 5 conexões, como em produção:

  | | Antes | Depois |
  | --- | ---: | ---: |
  | 1 envio de 40 itens | 3,2 s | **1,1 s** |
  | 50 motoristas ao mesmo tempo | **47 de 50 falharam** ("erro temporário") | **50 de 50 gravadas** |

- **A correção:** respostas gravadas num comando só, NCs ativas do veículo lidas uma vez, e espera de até 10 s por uma conexão no pico, em vez de 2 s.
- **Ainda recomendado:** o banco na mesma região da API. A Vercel está em São Paulo (`gru1`); o Neon tem região em São Paulo (`aws-sa-east-1`). Com os dois juntos, cada ida leva ~1 ms em vez de dezenas.

## Problemas encontrados e corrigidos

1. **Lista de inspeções lenta conforme o banco cresce.**
   - O contador de itens não conformes de cada linha agrupava **todas as respostas do banco, de todas as empresas**, a cada página aberta.
   - Agora conta só as 50 inspeções da página, com índice novo (`ChecklistAnswer(checklistId, isCompliant)`).
   - Resultado: 62 → 12 ms (1ª página) e 75 → 19 ms (página 400). Não cresce mais com o número de clientes.
2. **Lista de NCs e de veículos com o mesmo defeito.**
   - Reincidências e NCs ativas por veículo também eram contadas sobre a tabela inteira.
   - Resultado: 47 → 23 ms.
3. **Busca de inspeções.**
   - Ela juntava as 22.500 inspeções com veículos e colaboradores antes de filtrar.
   - Agora filtra primeiro as tabelas pequenas e usa índice. Resultado: 166 → 53 ms.
   - Com termo muito amplo (mais de 5.000 resultados), passa a trazer as **mais recentes**; antes trazia um conjunto qualquer.
4. **Envio lento e falhando no pico com o banco distante** (ver "Envio com o banco longe da API").
   - Respostas num comando só e mais tolerância a fila de conexões.
   - 47/50 falhas → 0.
5. **Internet caindo no meio da foto** aparecia como ERROR com rastro completo no log. Agora é aviso de uma linha.
6. **Falso alarme no log.**
   - Reenvio simultâneo da mesma inspeção (tratado corretamente como duplicado) aparecia como ERROR no log de produção.
   - Agora é aviso.

Antes das correções, 60 s de uso contínuo gravavam 1.426 inspeções; depois, 2.416 (+69%).

## Pendências recomendadas (não corrigidas aqui)

1. ~~**Atualizar bibliotecas do portal com alerta de segurança.**~~ Feito:
   - `next` 14 → 16.4.6, React 18 → 19, `jspdf` 2 → 4.2.1, `jspdf-autotable` 3 → 5.0.9;
   - `multer`, `body-parser` e outras com correção simples;
   - `shadcn`, que é ferramenta de linha de comando, passou para `devDependencies`, e saiu o `zod`, que não era usado.
   - `npm audit --omit=dev`: **0 alertas** (antes: 22, 2 críticos). Restam 15 só em ferramentas de desenvolvimento (lint/CLI), nenhum crítico.
2. ~~**Relatório do painel sobre todo o histórico.**~~ Feito:
   - A tela de Relatórios agora tem período: 7 dias, **30 dias (padrão)**, 90 dias, 12 meses ou tudo.
   - Com 90 dias de histórico: 7 dias = 31 ms, 30 dias = 52 ms, tudo = 72 ms.
   - O padrão não cresce com os anos de uso.
3. **Lista de NCs pesada (~180 KB por página de 50).**
   - Traz o cadastro completo do motorista e do veículo de cada NC.
   - Enxugar para os campos que a tela usa.
4. **Miniaturas das fotos no portal.**
   - O detalhe da inspeção carrega cada foto em tamanho cheio para mostrar uma miniatura de ~64 px.
   - Com 40 fotos são ~15 MB.
   - Sugestão: o app enviar também uma miniatura (~20 KB), ou o servidor gerá-la no upload.
5. **Banco e API na mesma região** (Neon em São Paulo), ver acima.
6. **Testes em aparelho e na infraestrutura real.**
   - Este benchmark mede a API.
   - Falta medir com celulares de entrada em rede 4G fraca e o tempo de partida a frio na Vercel/Neon, de preferência num ambiente de homologação com esta mesma massa de dados.
