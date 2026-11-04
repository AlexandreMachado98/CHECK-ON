# API de execução de checklist (contrato para o app mobile)

Todas as rotas exigem `Authorization: Bearer <token>`. Perfis aceitos: `ADMIN_EMPRESA`, `GESTOR`, `SUPERVISOR`, `MOTORISTA`.

## POST /checklists/submit

Envia uma execução completa.

```json
{
  "clientId": "6f1c2a8e-3b4d-4f5a-9c6b-7d8e9f0a1b2c",
  "templateId": "…",
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

Upload multipart com o campo `file` (JPEG, PNG ou WebP, até 5 MB). Resposta: `{ "photoUrl": "…" }`.

Fluxo no app:

1. O motorista tira a foto. Offline, ela fica guardada no aparelho junto com o checklist na fila.
2. Na sincronização, o app envia cada foto pendente para `/checklists/photos` e troca a referência local pela `photoUrl` devolvida.
3. Só então envia o checklist (`/checklists/submit` ou `/checklists/sync`) com `photoUrl` em cada resposta.

O servidor recusa (422) o checklist quando falta uma foto exigida ou quando a `photoUrl` não foi gerada por esta API para a mesma empresa. Se o upload da foto der certo mas o envio do checklist falhar, basta reenviar o checklist com a mesma `photoUrl`.
