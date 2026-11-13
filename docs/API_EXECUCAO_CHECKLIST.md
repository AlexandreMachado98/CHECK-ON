# API de execução de checklist (contrato para o app mobile)

Todas as rotas exigem `Authorization: Bearer <token>`. Perfis aceitos: `ADMIN_EMPRESA`, `GESTOR`, `SUPERVISOR`, `MOTORISTA`.

## Sessão do app

| Rota | Corpo | Resposta |
| --- | --- | --- |
| `POST /auth/login` | `{ "email", "password" }` | `{ access_token, refresh_token, refresh_token_expires_at, user }` |
| `POST /auth/refresh` | `{ "refreshToken" }` | Mesmo formato do login, com um **novo** `refresh_token` |
| `POST /auth/logout` | `{ "refreshToken" }` | 204. Encerra a sessão deste aparelho |
| `GET /auth/me` | — | Usuário logado com `role`, `permissions` e `employee` (funcionário vinculado, ou `null`) |

- O `access_token` vale pouco (`JWT_EXPIRES_IN`, padrão 1 dia). O `refresh_token` vale `REFRESH_TOKEN_EXPIRES_DAYS` (padrão 30 dias) e deve ficar guardado com segurança no aparelho (Keychain/Keystore).
- Ao receber 401 em qualquer rota, o app chama `/auth/refresh` e repete a requisição. Se o refresh também der 401, a sessão acabou: o app pede login de novo **sem apagar a fila offline**.
- Cada refresh troca o token: grave o novo `refresh_token` antes de usar o novo `access_token`. O token antigo continua aceito por 60 segundos (para o caso de a resposta se perder na rede). Depois disso, reapresentá-lo é tratado como roubo e derruba todas as sessões daquele login.
- Desativar o usuário ou a empresa invalida o refresh na próxima renovação.

## Carga de dados para operar offline

Perfis aceitos: `ADMIN_EMPRESA`, `GESTOR`, `SUPERVISOR`, `MOTORISTA`. Os dados são sempre da empresa do token.

### GET /mobile/bootstrap

Baixar ao fazer login e sempre que houver internet:

```json
{
  "serverTime": "2026-11-04T10:00:00.000Z",
  "templates": [
    { "id", "name", "description", "version", "updatedAt",
      "categories": [ { "id", "name", "order",
        "items": [ { "id", "text", "type", "isRequired", "isCritical", "photoRequirement", "order" } ] } ] }
  ],
  "vehicles": [ { "id", "plate", "prefix", "brand", "model", "year", "status", "mileage", "qrCode", "fleet": { "id", "name" } } ],
  "openNcs": [ { "id", "vehicleId", "itemId", "status", "severity", "notes", "occurrences", "lastOccurrenceAt", "createdAt", "item": { "text", "isCritical" } } ]
}
```

Só vêm modelos e veículos ativos e NCs `OPEN`/`IN_PROGRESS`. O pacote substitui por inteiro o que o app tinha guardado.

### GET /mobile/vehicles/by-qr/:qrCode

Veículo lido pelo QR Code, com `openNcs` do veículo para o alerta antes do checklist. 404 se o código não existir, o veículo estiver inativo ou for de outra empresa. Offline, o app procura o `qrCode` nos `vehicles` do bootstrap.

### GET /mobile/vehicles/:id/ncs

NCs ativas do veículo (mesmo formato de `openNcs`).

## POST /checklists/submit

Envia uma execução completa.

```json
{
  "clientId": "6f1c2a8e-3b4d-4f5a-9c6b-7d8e9f0a1b2c",
  "templateId": "…",
  "templateVersion": 3,
  "vehicleId": "…",
  "startedAt": "2026-11-04T10:00:00Z",
  "completedAt": "2026-11-04T10:12:00Z",
  "latitude": -20.75,
  "longitude": -51.68,
  "answers": [
    { "itemId": "…", "isCompliant": false, "observations": "Pneu dianteiro careca" },
    { "itemId": "…", "numberValue": 120500 },
    { "itemId": "…", "textValue": "Sem avarias" },
    { "itemId": "…", "photoUrl": "…" }
  ]
}
```

- `clientId` é um UUID v4 gerado no celular **uma única vez** por execução e reaproveitado em todo reenvio.
- `driverId` é opcional. Motoristas usam automaticamente o funcionário vinculado ao seu usuário; só `ADMIN_EMPRESA`, `GESTOR` e `SUPERVISOR` podem informar outro motorista.
- Itens `PASS_FAIL` exigem `isCompliant`. `NUMBER`, `TEXT` e `PHOTO` exigem o valor correspondente e são conformes por padrão (envie `isCompliant: false` para apontar problema).
- `completedAt` aceita até 5 minutos de adiantamento do relógio do aparelho.
- `templateVersion` é o `version` do modelo no bootstrap que o app usou para montar o checklist. Veja **Versão do modelo** abaixo.

Respostas:

| HTTP | Corpo | Significado |
| --- | --- | --- |
| 201 | `{ "status": "CREATED", "checklistId", "ncsOpened", "ncsRecurrent", "vehicleStatus" }` | Gravado |
| 200 | `{ "status": "DUPLICATE", "checklistId" }` | Esse `clientId` já tinha sido processado: marcar como sincronizado |
| 404/422 | mensagem de erro | Dados inválidos: não adianta reenviar sem corrigir |

## POST /checklists/sync

Lote de até 50 execuções feitas offline: `{ "checklists": [ …mesmo formato acima… ] }`. Sempre retorna 200 com um resultado por item, na mesma ordem:

```json
{ "results": [
  { "status": "CREATED", "clientId": "…", "checklistId": "…", "ncsOpened": 1, "ncsRecurrent": 0, "vehicleStatus": "BLOQUEADO" },
  { "status": "DUPLICATE", "clientId": "…", "checklistId": "…" },
  { "status": "REJECTED", "clientId": "…", "message": "Veículo não encontrado ou inativo." },
  { "status": "RETRY", "clientId": "…", "message": "Erro temporário no servidor." }
] }
```

`CREATED` e `DUPLICATE` saem da fila. `REJECTED` vai para revisão do usuário. `RETRY` continua na fila para a próxima tentativa.

## Regras aplicadas no servidor

- Cada resposta não conforme abre uma NC (`CRITICAL` se o item for crítico, `MEDIUM` caso contrário).
- **Reincidência:** se o mesmo item do mesmo veículo já tem NC `OPEN` ou `IN_PROGRESS`, a resposta é agrupada nela (`occurrences` +1, `recurrentNcId` na resposta) em vez de abrir outra NC.
- **Status do veículo:** NC crítica ativa → `BLOQUEADO`; outra NC ativa → `ATENCAO`. A chegada de um checklist só piora o status. Quando o gestor resolve ou encerra NCs (`PATCH /ncs/:id`), o status é recalculado e o veículo pode voltar a `LIBERADO`.
- NC `CLOSED` não pode ser reaberta (HTTP 409).

## Painel web: rotas complementares

- `POST /templates/categories/:id/items` e `PATCH /templates/items/:id` aceitam `isCritical` (boolean). Os corpos agora são validados: `tenantId` e `categoryId` não podem ser alterados pelo corpo da requisição.
- `GET /vehicles` devolve `fleet { id, name }` e `_count.ncs` (NCs ativas).
- `PATCH /vehicles/:id` aceita `status` (`LIBERADO`, `ATENCAO`, `BLOQUEADO`) para ajuste manual. Retorna 409 se o status pedido for mais brando do que as NCs ativas permitem (por exemplo, liberar com NC crítica ativa).
- `GET /dashboard/summary` inclui `vehicleStatus`, `ncs { active, critical, recurrent }` e `inspections { today, last7Days }`.

## Evidência fotográfica obrigatória

Cada item do modelo tem `photoRequirement`:

| Valor | Comportamento |
| --- | --- |
| `NONE` | Foto não é pedida (padrão) |
| `ON_NON_COMPLIANCE` | Foto obrigatória quando a resposta for não conforme |
| `ALWAYS` | Foto obrigatória em qualquer resposta |

Itens do tipo `PHOTO` continuam sendo controlados por `isRequired`.

### POST /checklists/photos

Upload multipart com o campo `file` (JPEG, PNG ou WebP, até 4 MB). Resposta: `{ "photoUrl": "…" }`.

Fluxo no app:

1. O motorista tira a foto. Offline, ela fica guardada no aparelho junto com o checklist na fila.
2. Na sincronização, o app envia cada foto pendente para `/checklists/photos` e troca a referência local pela `photoUrl` devolvida.
3. Só então envia o checklist (`/checklists/submit` ou `/checklists/sync`) com `photoUrl` em cada resposta.

O servidor recusa (422) o checklist quando falta uma foto exigida ou quando a `photoUrl` não foi gerada por esta API para a mesma empresa. Se o upload da foto der certo mas o envio do checklist falhar, basta reenviar o checklist com a mesma `photoUrl`.

## Versão do modelo e histórico

O gestor pode editar o modelo enquanto há checklists feitos offline esperando sincronização. Para nada se perder:

- Toda mudança em seções ou itens sobe o `version` do modelo. O app guarda o `version` junto com o modelo baixado e o envia como `templateVersion` em cada checklist.
- Item incluído depois da versão usada pelo app **não** é exigido naquele checklist.
- Item removido depois continua aceito: a resposta é gravada e, se não conforme, abre NC normalmente. Ele só deixa de ser obrigatório.
- Sem `templateVersion`, vale a versão atual (comportamento do painel web).
- Seção ou item que já tem respostas não é apagado: fica desativado, some do painel e do bootstrap, mas o histórico continua completo. Sem respostas, é apagado de verdade.
- Modelo com checklists registrados não pode ser excluído (HTTP 409): desative-o.
- Cada resposta guarda a cópia da pergunta (`itemText`, `itemType`, `itemIsCritical`, `categoryName`) e cada checklist guarda `templateVersion` e `templateName`. As telas de histórico e de NCs mostram a pergunta como estava no dia da inspeção, mesmo que o texto tenha mudado depois.
- O app deve baixar o bootstrap de novo sempre que tiver internet, para usar a versão mais recente nos próximos checklists.

## Listas paginadas do painel

`GET /checklists` e `GET /ncs` aceitam `?page=` (a partir de 1) e `?pageSize=` (até 200, padrão 50). Com `page`, a resposta é `{ items, total, page, pageSize }`; sem `page`, a rota devolve a lista completa como antes.

- `GET /checklists?page=1&search=abc1234&status=COMPLETED`: lista leve (sem as respostas, com `ncCount`). Os itens de cada inspeção vêm em `GET /checklists/:id`.
- `GET /ncs?page=1&status=ACTIVE&severity=CRITICAL&search=joao`: `status` aceita `ACTIVE` (abertas + em tratativa), `ALL` ou um status; a resposta traz também `counts { active, critical, recurrent }`.
- A busca (`search`) ignora acentos e maiúsculas e encontra a placa com ou sem hífen.

## Empresa (Configurações)

- `GET /company`: dados da empresa logada, plano e uso.
- `PATCH /company` (administrador): nome, CNPJ, endereço, e-mail e telefone de contato e `autoBlockCriticalNc`. Com `autoBlockCriticalNc: false`, NC crítica deixa o veículo em `ATENCAO` em vez de `BLOQUEADO`.
- `POST /company/revoke-sessions` (administrador): encerra todos os logins da empresa, no painel e no app. Os acessos abertos caem em até 30 segundos.

