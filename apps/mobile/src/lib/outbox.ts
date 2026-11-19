import { api } from './api';
import { cleanOrphanPhotos, deletePhoto, uploadPhoto } from './photos';
import { keys, readJson, writeJson } from './storage';
import { runSync, type SyncSummary } from './sync-core';
import type { Bootstrap, QueuedInspection, SubmitPayload, SyncItemResult } from './types';

// Uma alteração da fila por vez (salvar inspeção, descartar, sincronizar), para nada se perder.
let lock: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

export function readQueue(userId: string): Promise<QueuedInspection[]> {
  return readJson<QueuedInspection[]>(keys.outbox(userId)).then((q) => q ?? []);
}

export function enqueue(userId: string, item: QueuedInspection): Promise<void> {
  return exclusive(async () => {
    const queue = await readQueue(userId);
    await writeJson(keys.outbox(userId), [...queue.filter((q) => q.clientId !== item.clientId), item]);
  });
}

/** Tira da fila uma inspeção recusada pelo servidor (a pessoa leu o motivo e vai refazer). */
export function discard(userId: string, clientId: string): Promise<void> {
  return exclusive(async () => {
    const queue = await readQueue(userId);
    const item = queue.find((q) => q.clientId === clientId);
    item?.payload.answers.forEach((answer) => deletePhoto(answer.localPhotoUri));
    await writeJson(keys.outbox(userId), queue.filter((q) => q.clientId !== clientId));
  });
}

let syncing: Promise<SyncSummary> | null = null;

/** Envia a fila. Chamadas simultâneas reaproveitam o mesmo envio. */
export function syncQueue(userId: string): Promise<SyncSummary> {
  if (!syncing) {
    syncing = doSync(userId).finally(() => {
      syncing = null;
    });
  }
  return syncing;
}

async function doSync(userId: string): Promise<SyncSummary> {
  const snapshot = await readQueue(userId);
  const snapshotIds = new Set(snapshot.map((item) => item.clientId));
  if (!snapshot.some((item) => item.state === 'PENDING')) {
    return { sent: 0, rejected: snapshot.length, pending: 0, photosToDelete: [], offline: false };
  }

  const { summary } = await runSync(snapshot, {
    uploadPhoto,
    postSync: async (checklists: SubmitPayload[]) =>
      (await api<{ results: SyncItemResult[] }>('/checklists/sync', { method: 'POST', body: { checklists } })).results,
    // Grava o resultado sem apagar o que foi salvo ou descartado durante o envio.
    persist: (queue) =>
      exclusive(async () => {
        const stored = await readQueue(userId);
        const storedIds = new Set(stored.map((item) => item.clientId));
        const merged = [
          ...queue.filter((item) => storedIds.has(item.clientId)),
          ...stored.filter((item) => !snapshotIds.has(item.clientId)),
        ];
        await writeJson(keys.outbox(userId), merged);
      }),
  });
  summary.photosToDelete.forEach(deletePhoto);
  return summary;
}

/** Apaga do aparelho as fotos que não estão na fila nem no rascunho atual. */
export async function cleanupPhotos(userId: string): Promise<void> {
  await exclusive(async () => {
    const queue = await readQueue(userId);
    const draft = await readJson<{ answers?: Record<string, { localPhotoUri?: string }> }>(keys.draft(userId));
    const inUse = [
      ...queue.flatMap((item) => item.payload.answers.map((a) => a.localPhotoUri)),
      ...Object.values(draft?.answers ?? {}).map((a) => a.localPhotoUri),
    ].filter((uri): uri is string => !!uri);
    cleanOrphanPhotos(inUse);
  });
}

/** Baixa os dados para trabalhar sem internet (modelos, veículos, NCs em aberto). */
export async function downloadBootstrap(userId: string): Promise<Bootstrap> {
  const data = await api<Omit<Bootstrap, 'downloadedAt'>>('/mobile/bootstrap');
  const bootstrap: Bootstrap = { ...data, downloadedAt: new Date().toISOString() };
  await writeJson(keys.bootstrap(userId), bootstrap);
  return bootstrap;
}

export function readBootstrap(userId: string): Promise<Bootstrap | null> {
  return readJson<Bootstrap>(keys.bootstrap(userId));
}
