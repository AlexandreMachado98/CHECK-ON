import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { DrivingService } from './driving.service';
import { isAlert, shortName } from './driving-rules';

const TOKEN = 'a'.repeat(32);
const vehicle = { id: 'v1', tenantId: 't1', plate: 'ABC1D23', prefix: 'P-1', model: 'Ônibus', fleet: { unitId: 'u1' }, tenant: { name: 'Transportes Sul' } };
const at = (h: number) => new Date(Date.UTC(2026, 10, 26, h));
const chk = (id: string, vehicleId: string, driverId: string, name: string, h: number, plate = 'ABC1D23') => ({
  id, vehicleId, driverId, completedAt: at(h), driver: { name }, vehicle: { plate, prefix: null, model: null },
});

function service({ checklists = [] as unknown[], recent = null as unknown, found = vehicle as unknown } = {}) {
  const prisma = {
    vehicle: { findFirst: vi.fn().mockResolvedValue(found) },
    checklist: { findMany: vi.fn().mockResolvedValue(checklists) },
    drivingFeedback: {
      findFirst: vi.fn().mockResolvedValue(recent),
      create: vi.fn().mockResolvedValue({ id: 'fb1' }),
      update: vi.fn(({ data }) => Promise.resolve({ id: 'fb1', ...data })),
    },
    user: { findFirst: vi.fn().mockResolvedValue({ name: 'Gestora Ana' }) },
    $queryRaw: vi.fn().mockResolvedValue([{ count: 0 }]),
    $executeRaw: vi.fn(),
  };
  return { driving: new DrivingService(prisma as never), prisma };
}

afterEach(() => vi.restoreAllMocks());

describe('Como estou dirigindo — página do passageiro', () => {
  it('motorista atual é o do checklist mais recente do veículo; os outros do dia vêm em ordem alfabética, sem repetir', async () => {
    const { driving } = service({
      checklists: [
        chk('c5', 'v2', 'd2', 'Bruno Lima', 14, 'XYZ9A88'), // Bruno inspecionou outro veículo depois
        chk('c4', 'v1', 'd2', 'Bruno Lima', 12), // ... mas é o último a inspecionar este
        chk('c3', 'v3', 'd3', 'Ana Paula Souza', 11, 'QWE1R22'),
        chk('c2', 'v1', 'd1', 'Carlos Eduardo de Souza', 7), // motorista da manhã neste veículo
        chk('c1', 'v3', 'd3', 'Ana Paula Souza', 6, 'QWE1R22'),
      ],
    });
    const res = await driving.publicVehicle(TOKEN);
    expect(res.companyName).toBe('Transportes Sul');
    expect(res.current).toMatchObject({ checklistId: 'c4', driverName: 'Bruno L.', plate: 'ABC1D23' });
    expect(res.others.map((o) => [o.checklistId, o.driverName])).toEqual([['c3', 'Ana S.'], ['c2', 'Carlos S.']]);
  });

  it('QR inválido ou trocado: 404 sem consultar nada', async () => {
    const { driving, prisma } = service();
    await expect(driving.publicVehicle('curto')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.vehicle.findFirst).not.toHaveBeenCalled();
    const gone = service({ found: null });
    await expect(gone.driving.publicVehicle(TOKEN)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('grava a avaliação com o motorista do checklist escolhido e marca alerta para celular ao volante', async () => {
    const { driving, prisma } = service({ checklists: [chk('c4', 'v1', 'd2', 'Bruno Lima', 12)] });
    await driving.submit(TOKEN, { checklistId: 'c4', rating: 4, tags: ['CELULAR', 'CELULAR'], comment: '  usou o celular  ', deviceId: 'aparelho-123' }, '1.2.3.4');
    const data = prisma.drivingFeedback.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ tenantId: 't1', vehicleId: 'v1', checklistId: 'c4', driverId: 'd2', rating: 4, tags: ['CELULAR'], comment: 'usou o celular', alert: true });
    expect(data.deviceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.deviceHash).not.toContain('aparelho');
  });

  it('recusa motorista fora da lista de hoje e repetição do mesmo aparelho', async () => {
    const { driving } = service({ checklists: [chk('c4', 'v1', 'd2', 'Bruno Lima', 12)] });
    await expect(driving.submit(TOKEN, { checklistId: '00000000-0000-0000-0000-000000000000', rating: 5 }, '1.2.3.4')).rejects.toBeInstanceOf(BadRequestException);
    const again = service({ checklists: [chk('c4', 'v1', 'd2', 'Bruno Lima', 12)], recent: { id: 'old' } });
    await expect(again.driving.submit(TOKEN, { checklistId: 'c4', rating: 5, deviceId: 'aparelho-123' }, '1.2.3.4')).rejects.toBeInstanceOf(HttpException);
    expect(again.prisma.drivingFeedback.create).not.toHaveBeenCalled();
  });

  it('sem motorista identificado: avaliação só do veículo', async () => {
    const { driving, prisma } = service();
    await driving.submit(TOKEN, { rating: 2 }, undefined);
    expect(prisma.drivingFeedback.create.mock.calls[0][0].data).toMatchObject({ driverId: null, checklistId: null, alert: true, deviceHash: null });
  });
});

describe('Como estou dirigindo — tratativa do gestor', () => {
  it('marcar como tratada exige descrever o que foi feito e guarda quem tratou', async () => {
    const { driving, prisma } = service();
    prisma.drivingFeedback.findFirst.mockResolvedValue({ id: 'fb1' });
    await expect(driving.treat('fb1', { status: 'TRATADA', treatment: 'ok' }, { id: 'u1' })).rejects.toBeInstanceOf(BadRequestException);
    const res = await driving.treat('fb1', { status: 'TRATADA', treatment: 'Conversa com o motorista e reciclagem de direção defensiva.' }, { id: 'u1' });
    expect(res).toMatchObject({ status: 'TRATADA', treatedByName: 'Gestora Ana' });
    expect(res.treatedAt).toBeInstanceOf(Date);
    const back = await driving.treat('fb1', { status: 'EM_ANALISE' }, { id: 'u1' });
    expect(back).toMatchObject({ status: 'EM_ANALISE', treatedAt: null, treatedByName: null });
  });
});

describe('Regras', () => {
  it('nome curto e alerta', () => {
    expect(shortName('Carlos Eduardo de Souza')).toBe('Carlos S.');
    expect(shortName('Ana')).toBe('Ana');
    expect(shortName('Motorista 136')).toBe('Motorista 136');
    expect(shortName('  maria   dos santos ')).toBe('maria S.');
    expect(isAlert(2, [])).toBe(true);
    expect(isAlert(5, ['CELULAR'])).toBe(true);
    expect(isAlert(3, ['VELOCIDADE'])).toBe(false);
  });
});
