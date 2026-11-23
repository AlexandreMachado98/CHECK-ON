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
| Relatório do painel (todo o histórico) | 83 ms | 105 ms |
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
4. **Falso alarme no log.**
   - Reenvio simultâneo da mesma inspeção (tratado corretamente como duplicado) aparecia como ERROR no log de produção.
   - Agora é aviso.

Antes das correções, 60 s de uso contínuo gravavam 1.426 inspeções; depois, 2.416 (+69%).

## Pendências recomendadas (não corrigidas aqui)

1. **Atualizar bibliotecas do portal com alerta de segurança.**
   - `npm audit` aponta 22 alertas (2 críticos).
   - Os críticos, `next` 14 → 16 e `jspdf` 2 → 4, são atualizações de versão principal: precisam de PR próprio e de teste do portal.
   - Os demais (ex.: `multer`, `body-parser` na API) saem com atualização simples, mas o `npm audit fix` automático esbarra em conflito de versões entre pacotes.
2. **Relatório do painel sobre todo o histórico** (83 ms com 90 dias).
   - Cresce com o tempo: ~2 anos de uso devem passar de 0,5 s.
   - Sugestão: filtrar por período (ex.: últimos 90 dias), como já faz o resumo.
3. **Lista de NCs pesada (~180 KB por página de 50).**
   - Traz o cadastro completo do motorista e do veículo de cada NC.
   - Enxugar para os campos que a tela usa.
4. **Testes em aparelho e na infraestrutura real.**
   - Este benchmark mede a API.
   - Falta medir com celulares de entrada em rede 4G fraca e o tempo de partida a frio na Vercel/Neon, de preferência num ambiente de homologação com esta mesma massa de dados.
