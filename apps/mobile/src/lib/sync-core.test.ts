import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSync, toApiPayload } from './sync-core.ts';

const offline = () => Object.assign(new Error('Sem conexão'), { offline: true });

function queued(clientId: string, answers: Record<string, unknown>[] = [{ itemId: 'a', isCompliant: true }]) {
  return {
    clientId,
    vehicleLabel: 'ABC1D23',
    templateName: 'Diário',
    queuedAt: '2026-11-19T10:00:00Z',
    state: 'PENDING' as const,
    attempts: 0,
    payload: { clientId, templateId: 't', templateVersion: 1, vehicleId: 'v', startedAt: 'x', completedAt: 'y', answers },
  };
}

test('envia fotos uma vez, manda o lote e tira da fila o que foi aceito', async () => {
  const uploads: string[] = [];
  const sent: unknown[] = [];
  const queue = [queued('c1', [{ itemId: 'a', isCompliant: false, localPhotoUri: 'file:///1.jpg' }]), queued('c2')];
  const { queue: rest, summary } = await runSync(queue, {
    uploadPhoto: async (uri) => {
      uploads.push(uri);
      return 'https://storage/1.jpg';
    },
    postSync: async (list) => {
      sent.push(...list);
      return [
        { status: 'CREATED', clientId: 'c1', checklistId: 'x', ncsOpened: 1, ncsRecurrent: 0, vehicleStatus: 'ATENCAO' },
        { status: 'DUPLICATE', clientId: 'c2', checklistId: 'y' },
      ];
    },
    persist: async () => undefined,
  });
  assert.deepEqual(uploads, ['file:///1.jpg']);
  assert.deepEqual((sent[0] as { answers: unknown[] }).answers, [{ itemId: 'a', isCompliant: false, photoUrl: 'https://storage/1.jpg' }]);
  assert.equal(rest.length, 0);
  assert.equal(summary.sent, 2);
  assert.deepEqual(summary.photosToDelete, ['file:///1.jpg']);
});

test('sem internet: nada sai da fila e a foto já enviada não é reenviada depois', async () => {
  let saved: ReturnType<typeof queued>[] = [];
  const queue = [queued('c1', [
    { itemId: 'a', isCompliant: false, localPhotoUri: 'file:///1.jpg' },
    { itemId: 'b', isCompliant: false, localPhotoUri: 'file:///2.jpg' },
  ])];
  let calls = 0;
  const first = await runSync(queue, {
    uploadPhoto: async () => {
      calls++;
      if (calls === 2) throw offline();
      return 'https://storage/1.jpg';
    },
    postSync: async () => assert.fail('não deveria enviar sem as fotos'),
    persist: async (q) => {
      saved = JSON.parse(JSON.stringify(q));
    },
  });
  assert.equal(first.summary.offline, true);
  assert.equal(first.queue.length, 1);
  assert.equal(saved[0].payload.answers[0].photoUrl, 'https://storage/1.jpg');

  const uploads: string[] = [];
  const second = await runSync(saved, {
    uploadPhoto: async (uri) => {
      uploads.push(uri);
      return 'https://storage/2.jpg';
    },
    postSync: async () => [{ status: 'CREATED', clientId: 'c1', checklistId: 'x', ncsOpened: 2, ncsRecurrent: 0, vehicleStatus: 'ATENCAO' }],
    persist: async () => undefined,
  });
  assert.deepEqual(uploads, ['file:///2.jpg']);
  assert.equal(second.queue.length, 0);
});

test('recusa do servidor fica marcada; erro temporário continua pendente', async () => {
  const { queue, summary } = await runSync([queued('c1'), queued('c2')], {
    uploadPhoto: async () => 'x',
    postSync: async () => [
      { status: 'REJECTED', clientId: 'c1', message: 'Veículo não encontrado ou inativo.' },
      { status: 'RETRY', clientId: 'c2', message: 'Erro temporário no servidor.' },
    ],
    persist: async () => undefined,
  });
  assert.equal(queue.find((q) => q.clientId === 'c1')?.state, 'REJECTED');
  assert.equal(queue.find((q) => q.clientId === 'c1')?.message, 'Veículo não encontrado ou inativo.');
  assert.equal(queue.find((q) => q.clientId === 'c2')?.state, 'PENDING');
  assert.equal(summary.rejected, 1);
  assert.equal(summary.pending, 1);
});

test('inspeção já recusada não é reenviada', async () => {
  const rejected = { ...queued('c1'), state: 'REJECTED' as const, message: 'x' };
  const { summary } = await runSync([rejected], {
    uploadPhoto: async () => 'x',
    postSync: async () => assert.fail('não deveria enviar'),
    persist: async () => undefined,
  });
  assert.equal(summary.sent, 0);
});

test('o corpo enviado não leva o caminho local da foto', () => {
  const payload = queued('c1', [{ itemId: 'a', isCompliant: true, localPhotoUri: 'file:///1.jpg', photoUrl: 'https://s/1.jpg' }]).payload;
  assert.deepEqual(toApiPayload(payload).answers, [{ itemId: 'a', isCompliant: true, photoUrl: 'https://s/1.jpg' }]);
});
