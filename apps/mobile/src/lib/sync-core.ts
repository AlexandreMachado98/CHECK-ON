// Lógica da fila de envio, sem React Native (testada com `npm test`).

import type { QueuedInspection, SubmitPayload, SyncItemResult } from './types';

export type SyncDeps = {
  /** Envia a foto e devolve o photoUrl. Lança erro com `offline: true` quando não há conexão. */
  uploadPhoto: (localUri: string) => Promise<string>;
  /** POST /checklists/sync com até 50 inspeções. */
  postSync: (checklists: SubmitPayload[]) => Promise<SyncItemResult[]>;
  /** Chamado depois de cada mudança, para gravar a fila no aparelho (não perde fotos já enviadas). */
  persist: (queue: QueuedInspection[]) => Promise<void>;
};

export type SyncSummary = {
  sent: number;
  rejected: number;
  pending: number;
  /** Fotos locais que podem ser apagadas (inspeção aceita pelo servidor). */
  photosToDelete: string[];
  /** Parou por falta de conexão. */
  offline: boolean;
  /** Mensagem do primeiro erro que não foi de conexão (ex.: foto recusada). */
  error?: string;
};

const BATCH = 20;

function isOffline(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'offline' in error && (error as { offline: boolean }).offline === true;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Erro ao enviar.';
}

/** Corpo que vai para a API: sem o caminho local das fotos. */
export function toApiPayload(payload: SubmitPayload): SubmitPayload {
  return {
    ...payload,
    answers: payload.answers.map(({ localPhotoUri: _local, ...answer }) => answer),
  };
}

export function hasPendingUpload(item: QueuedInspection): boolean {
  return item.payload.answers.some((answer) => answer.localPhotoUri && !answer.photoUrl);
}

/**
 * Envia o que estiver pendente: primeiro as fotos (cada uma uma vez só), depois as inspeções em lote.
 * Sem conexão, para e mantém tudo na fila. Recusa do servidor fica marcada para a pessoa ver.
 */
export async function runSync(initial: QueuedInspection[], deps: SyncDeps): Promise<{ queue: QueuedInspection[]; summary: SyncSummary }> {
  let queue = initial.map((item) => ({ ...item, payload: { ...item.payload, answers: item.payload.answers.map((a) => ({ ...a })) } }));
  const summary: SyncSummary = { sent: 0, rejected: 0, pending: 0, photosToDelete: [], offline: false };

  const ready: QueuedInspection[] = [];
  for (const item of queue) {
    if (item.state !== 'PENDING') continue;
    let uploadFailed = false;
    for (const answer of item.payload.answers) {
      if (!answer.localPhotoUri || answer.photoUrl) continue;
      try {
        answer.photoUrl = await deps.uploadPhoto(answer.localPhotoUri);
        await deps.persist(queue);
      } catch (error) {
        if (isOffline(error)) {
          summary.offline = true;
        } else {
          // Foto recusada (arquivo corrompido, apagado...): a pessoa precisa saber.
          item.state = 'REJECTED';
          item.message = `Não foi possível enviar uma foto: ${messageOf(error)}`;
          summary.error ??= item.message;
          await deps.persist(queue);
        }
        uploadFailed = true;
        break;
      }
    }
    if (summary.offline) break;
    if (!uploadFailed) ready.push(item);
  }

  for (let start = 0; start < ready.length && !summary.offline; start += BATCH) {
    const batch = ready.slice(start, start + BATCH);
    let results: SyncItemResult[];
    try {
      results = await deps.postSync(batch.map((item) => toApiPayload(item.payload)));
    } catch (error) {
      if (isOffline(error)) summary.offline = true;
      else summary.error ??= messageOf(error);
      break;
    }
    const byId = new Map(results.map((result) => [result.clientId, result]));
    const done = new Set<string>();
    for (const item of batch) {
      const result = byId.get(item.clientId);
      if (!result) continue;
      if (result.status === 'CREATED' || result.status === 'DUPLICATE') {
        done.add(item.clientId);
        summary.sent++;
        for (const answer of item.payload.answers) if (answer.localPhotoUri) summary.photosToDelete.push(answer.localPhotoUri);
      } else if (result.status === 'REJECTED') {
        item.state = 'REJECTED';
        item.message = result.message;
      } else {
        item.attempts++;
      }
    }
    queue = queue.filter((item) => !done.has(item.clientId));
    await deps.persist(queue);
  }

  summary.rejected = queue.filter((item) => item.state === 'REJECTED').length;
  summary.pending = queue.filter((item) => item.state === 'PENDING').length;
  return { queue, summary };
}
