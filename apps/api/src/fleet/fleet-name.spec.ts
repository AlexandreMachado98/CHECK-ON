import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { FleetService } from './fleet.service';

const UNIT = 'unit-1';

function service(clash: { id: string } | null, current = { id: 'f1', name: 'Caminhões 1', unitId: UNIT }) {
  const prisma = {
    unit: { findFirst: vi.fn().mockResolvedValue({ id: UNIT }) },
    fleet: {
      findFirst: vi.fn().mockResolvedValue(clash),
      findUnique: vi.fn().mockResolvedValue(current),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'novo', ...data })),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...current, ...data })),
    },
  };
  return { fleets: new FleetService(prisma as never), prisma };
}

describe('Frota — nome repetido na mesma frente', () => {
  it('recusa criar frota com o nome de outra da mesma frente (sem diferenciar maiúsculas)', async () => {
    const { fleets, prisma } = service({ id: 'outra' });
    await expect(fleets.create({ name: '  máquinas 1 ', unitId: UNIT })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.fleet.findFirst.mock.calls[0][0].where).toEqual({ unitId: UNIT, name: { equals: 'máquinas 1', mode: 'insensitive' } });
    expect(prisma.fleet.create).not.toHaveBeenCalled();
  });

  it('cria com o nome sem espaços nas pontas quando não há outra igual', async () => {
    const { fleets, prisma } = service(null);
    await fleets.create({ name: '  Máquinas 4 ', unitId: UNIT });
    expect(prisma.fleet.create.mock.calls[0][0].data.name).toBe('Máquinas 4');
  });

  it('renomear para o nome de outra da mesma frente é recusado; a própria frota não conta', async () => {
    const { fleets, prisma } = service({ id: 'outra' });
    await expect(fleets.update('f1', { name: 'Máquinas 1' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.fleet.findFirst.mock.calls[0][0].where.NOT).toEqual({ id: 'f1' });
  });

  it('mudar só a descrição ou a situação não confere o nome', async () => {
    const { fleets, prisma } = service({ id: 'outra' });
    await fleets.update('f1', { description: 'Base sul', isActive: false });
    expect(prisma.fleet.findFirst).not.toHaveBeenCalled();
    expect(prisma.fleet.update).toHaveBeenCalled();
  });
});
