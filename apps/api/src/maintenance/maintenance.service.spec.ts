import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';
import * as unitScope from '../common/unit-scope';
import { MaintenanceService } from './maintenance.service';

const vehicle = (id: string, plate: string, mileage: number, fleetId = 'f1') => ({ id, plate, mileage, fleetId, prefix: null, brand: null, model: null, status: 'LIBERADO', fleet: { id: fleetId, name: 'Frota', unit: null } });
const oil = { id: 'oleo', name: 'Troca de óleo', intervalKm: 10_000, intervalDays: null, warnBeforeKm: 1_000, fleetId: null };
const tires = { id: 'pneu', name: 'Rodízio de pneus', intervalKm: 20_000, intervalDays: null, warnBeforeKm: 1_000, fleetId: 'f2' };

function service({ scope = null as string[] | null, vehicles = [] as unknown[], plans = [] as unknown[], last = [] as unknown[] } = {}) {
  vi.spyOn(ClsServiceManager, 'getClsService').mockReturnValue({ get: () => 't1' } as never);
  vi.spyOn(unitScope, 'currentUnitIds').mockReturnValue(scope);
  const tx = {
    maintenanceRecord: { create: vi.fn(({ data }) => Promise.resolve({ id: 'r1', ...data })) },
    vehicle: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    vehicle: { findMany: vi.fn().mockResolvedValue(vehicles), findFirst: vi.fn() },
    maintenancePlan: {
      findMany: vi.fn().mockResolvedValue(plans),
      findFirst: vi.fn(),
      create: vi.fn(({ data }) => Promise.resolve({ id: 'p1', ...data })),
      update: vi.fn(({ data }) => Promise.resolve({ id: 'p1', ...data })),
    },
    fleet: { findFirst: vi.fn().mockResolvedValue({ id: 'f1' }) },
    user: { findFirst: vi.fn().mockResolvedValue({ name: 'Gestor Ana' }) },
    $queryRaw: vi.fn().mockResolvedValue(last),
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { maintenance: new MaintenanceService(prisma as never), prisma, tx };
}

afterEach(() => vi.restoreAllMocks());

describe('Manutenção por km', () => {
  it('situação de cada veículo com os planos que valem para ele, vencidos primeiro', async () => {
    const { maintenance } = service({
      vehicles: [vehicle('a', 'AAA1A11', 52_000), vehicle('b', 'BBB2B22', 61_200), vehicle('c', 'CCC3C33', 0, 'f2'), vehicle('d', 'DDD4D44', 30_500, 'f2')],
      plans: [tires, oil],
      last: [{ vehicleId: 'b', planId: 'oleo', km: 50_000, performedAt: new Date('2026-06-01') }],
    });
    const res = await maintenance.overview(new Date('2026-11-26'));
    // Vencido, depois sem km, depois em dia pelo que falta menos (AAA: 8.000 km; DDD: 9.500 km).
    expect(res.vehicles.map((v) => [v.plate, v.state])).toEqual([
      ['BBB2B22', 'VENCIDA'],
      ['CCC3C33', 'SEM_KM'],
      ['AAA1A11', 'EM_DIA'],
      ['DDD4D44', 'EM_DIA'],
    ]);
    // Plano de pneus é só da frota f2; o de óleo vale para todos.
    expect(res.vehicles.find((v) => v.plate === 'AAA1A11')!.plans.map((p) => p.planId)).toEqual(['oleo']);
    expect(res.vehicles.find((v) => v.plate === 'DDD4D44')!.plans.map((p) => p.planId).sort()).toEqual(['oleo', 'pneu']);
    expect(res.summary).toMatchObject({ VENCIDA: 1, PROXIMA: 0, SEM_KM: 1, EM_DIA: 2, SEM_PLANO: 0 });
  });

  it('gestor limitado a frentes: não cria nem altera plano da empresa toda', async () => {
    const { maintenance, prisma } = service({ scope: ['u1'] });
    await expect(maintenance.createPlan({ name: 'Óleo', intervalKm: 10_000 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(maintenance.createPlan({ name: 'Óleo', intervalKm: 10_000, fleetId: 'f1' })).resolves.toMatchObject({ fleetId: 'f1', warnBeforeKm: 1_000 });
    prisma.maintenancePlan.findFirst.mockResolvedValue({ ...oil, isActive: true });
    await expect(maintenance.updatePlan('oleo', { intervalKm: 12_000 })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(maintenance.removePlan('oleo')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('aviso antecipado precisa ser menor que o intervalo; padrão é 10% do intervalo, até 1.000 km', async () => {
    const { maintenance } = service();
    await expect(maintenance.createPlan({ name: 'Óleo', intervalKm: 5_000, warnBeforeKm: 5_000 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(maintenance.createPlan({ name: ' Filtro de ar ', intervalKm: 5_000 })).resolves.toMatchObject({ name: 'Filtro de ar', warnBeforeKm: 500, fleetId: null });
  });

  it('registrar manutenção do plano: usa o nome do plano, guarda quem registrou e sobe o km do veículo', async () => {
    const { maintenance, prisma, tx } = service();
    prisma.vehicle.findFirst.mockResolvedValue({ id: 'a', fleetId: 'f1', mileage: 60_000 });
    prisma.maintenancePlan.findFirst.mockResolvedValue({ ...oil, isActive: true });
    const res = await maintenance.createRecord({ vehicleId: 'a', planId: 'oleo', performedAt: '2026-11-25', km: 60_350, cost: 480.5 }, { id: 'user-1' });
    expect(res).toMatchObject({ title: 'Troca de óleo', km: 60_350, cost: 480.5, createdByName: 'Gestor Ana' });
    expect(tx.vehicle.updateMany).toHaveBeenCalledWith({ where: { id: 'a', mileage: { lt: 60_350 } }, data: { mileage: 60_350 } });
  });

  it('recusa plano que não vale para o veículo, serviço sem nome e data no futuro', async () => {
    const { maintenance, prisma } = service();
    prisma.vehicle.findFirst.mockResolvedValue({ id: 'a', fleetId: 'f1', mileage: 60_000 });
    prisma.maintenancePlan.findFirst.mockResolvedValue({ ...tires, isActive: true });
    await expect(maintenance.createRecord({ vehicleId: 'a', planId: 'pneu', performedAt: '2026-11-25', km: 60_000 }, { id: 'u' })).rejects.toThrow('não vale para este veículo');
    await expect(maintenance.createRecord({ vehicleId: 'a', performedAt: '2026-11-25', km: 60_000 }, { id: 'u' })).rejects.toThrow('descreva o serviço');
    await expect(maintenance.createRecord({ vehicleId: 'a', title: 'Freio', performedAt: '2099-01-01', km: 60_000 }, { id: 'u' })).rejects.toThrow('futuro');
  });
});
