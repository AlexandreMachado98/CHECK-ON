# Frentes de trabalho (contratos)

Uma empresa pode ter várias frentes de trabalho ou contratos, cada um com a sua frota e a sua equipe. Quem trabalha numa frente não vê os dados das outras.

## Quem vê o quê

| Perfil | Vê | Onde se escolhe |
| --- | --- | --- |
| Administrador da empresa | Todas as frentes | — |
| Gestor e supervisor | Só as frentes marcadas no login | Portal → Usuários |
| Motorista (aplicativo) | Só os veículos das frentes do colaborador | Portal → Colaboradores |

O limite vale para frotas, veículos, inspeções, NCs (e tratativas), colaboradores, usuários, modelos de checklist, painel e relatórios. Um registro de outra frente responde como inexistente (404), inclusive quando é pedido pelo id.

## Cadastros

- **Frentes de trabalho** (Portal → Frentes de trabalho, só o administrador): nome e cliente do contrato. Uma frente com frotas não pode ser excluída, só desativada. Frente desativada some para gestores, supervisores e motoristas.
- **Frotas:** cada frota pertence a uma frente. Os veículos, as inspeções e as NCs seguem a frente da frota. Mudar a frota de frente move tudo junto.
- **Modelos de checklist:** valem em "todas as frentes" ou só nas frentes escolhidas. No aplicativo, o checklist só aparece para os veículos dessas frentes, e a API recusa a inspeção de um modelo em veículo de outra frente.
  - Só o administrador marca "todas as frentes".
  - Gestor só altera modelos que valem apenas nas frentes dele. Modelo compartilhado com outras frentes fica só para consulta.
- **Vínculos editados por gestor:** ele só marca ou desmarca as frentes dele. As frentes que ele não vê continuam no cadastro, e ele não pode deixar o registro sem nenhuma das suas frentes.

## Empresa com uma frente só

Nada muda: as telas não pedem para escolher frente e tudo entra na única frente da empresa. A migração `20261121021024_work_fronts` cria a "Unidade principal" para quem não tinha nenhuma frente. Também vincula todos os colaboradores, gestores e supervisores às frentes existentes e deixa os modelos valendo em todas.

## Como funciona na API

- `TenantInterceptor` calcula as frentes de quem está logado em cada requisição e guarda no contexto (`unitScope`). Administrador e super admin ficam sem escopo (veem tudo).
- A extensão do Prisma (`prisma.service.ts`) acrescenta o filtro da frente em toda leitura, alteração e exclusão, como já fazia com a empresa (`common/unit-scope.ts`).
- Consultas em SQL direto (painel e relatórios) não passam pela extensão e usam os filtros `sql*InScope` de `common/unit-scope.ts`. Toda consulta nova em SQL direto precisa deles.
