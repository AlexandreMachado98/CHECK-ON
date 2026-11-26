import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';
import { ElectromechanicalService } from './em.service';
import { addDaysIso, todayIso } from './em-rules';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const today = todayIso();

function service({ vehicle = { id: 'v1', emExpiresAt: null as Date | null, emReleasedUntil: null as Date | null }, maxExpires = null as Date | null } = {}) {
  vi.spyOn(ClsServiceManager, 'getClsService').mockReturnValue({ get: () => 't1' } as never);
  const tx = {
    electromechanicalInspection: {
      create: vi.fn(({ data }) => Promise.resolve({ id: 'i1', ...data })),
      delete: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn().mockResolvedValue({ _max: { expiresAt: maxExpires } }),
    },
    electromechanicalRelease: { create: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    vehicle: { update: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    vehicle: { findFirst: vi.fn().mockResolvedValue(vehicle) },
    user: { findFirst: vi.fn().mockResolvedValue({ name: 'Gestora Ana' }) },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const storage = { isChecklistPhotoUrl: vi.fn().mockReturnValue(true), canonicalUrl: vi.fn((u: string) => u) };
  return { em: new ElectromechanicalService(prisma as never, storage as never), prisma, tx };
}

afterEach(() => vi.restoreAllMocks());

describe('Inspeção eletromecânica — registro', () => {
  it('nova inspeção válida atualiza a validade do veículo e encerra a liberação provisória', async () => {
    const expires = addDaysIso(today, 365);
    const { em, tx } = service({ maxExpires: day(expires) });
    const res = await em.create({ vehicleId: 'v1', performedAt: today, expiresAt: expires, provider: ' Oficina X ', reportNumber: 'L-123' }, { id: 'u1' });
    expect(res).toMatchObject({ provider: 'Oficina X', reportNumber: 'L-123', createdByName: 'Gestora Ana', expiresAt: expires });
    expect(tx.vehicle.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { emExpiresAt: day(expires), emReleasedUntil: null } });
    expect(tx.electromechanicalRelease.updateMany).toHaveBeenCalled();
  });

  it('recusa data no futuro, validade antes da inspeção e validade absurda', async () => {
    const { em } = service();
    await expect(em.create({ vehicleId: 'v1', performedAt: addDaysIso(today, 2), expiresAt: addDaysIso(today, 300) }, { id: 'u' })).rejects.toThrow('futuro');
    await expect(em.create({ vehicleId: 'v1', performedAt: today, expiresAt: today }, { id: 'u' })).rejects.toThrow('depois da data');
    await expect(em.create({ vehicleId: 'v1', performedAt: today, expiresAt: addDaysIso(today, 3000) }, { id: 'u' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Inspeção eletromecânica — liberação provisória', () => {
  const expired = { id: 'v1', emExpiresAt: day(addDaysIso(today, -3)), emReleasedUntil: null };

  it('só com a inspeção vencida, até 30 dias e com justificativa registrada', async () => {
    const ok = service({ vehicle: expired });
    await expect(ok.em.release('v1', { until: addDaysIso(today, 7), reason: 'Laudo feito ontem, aguardando o documento.' }, { id: 'u1' })).resolves.toMatchObject({ ok: true });
    expect(ok.tx.electromechanicalRelease.create.mock.calls[0][0].data).toMatchObject({ vehicleId: 'v1', byName: 'Gestora Ana', reason: 'Laudo feito ontem, aguardando o documento.' });
    expect(ok.tx.vehicle.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { emReleasedUntil: day(addDaysIso(today, 7)) } });

    await expect(service({ vehicle: expired }).em.release('v1', { until: addDaysIso(today, 31), reason: 'Laudo feito ontem, aguardando.' }, { id: 'u1' })).rejects.toThrow('no máximo 30 dias');
    await expect(service({ vehicle: expired }).em.release('v1', { until: addDaysIso(today, -1), reason: 'Laudo feito ontem, aguardando.' }, { id: 'u1' })).rejects.toThrow('até hoje');
    const valid = service({ vehicle: { id: 'v1', emExpiresAt: day(addDaysIso(today, 40)), emReleasedUntil: null } });
    await expect(valid.em.release('v1', { until: addDaysIso(today, 5), reason: 'Teste de liberação sem vencer.' }, { id: 'u1' })).rejects.toBeInstanceOf(ConflictException);
  });
});
