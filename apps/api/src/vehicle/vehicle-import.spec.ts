import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { VehicleService } from './vehicle.service';

function service({ existing = [] as string[], fleets = [{ id: 'f1', name: 'Caminhões 1' }, { id: 'f2', name: 'Máquinas 1' }], createError = null as unknown } = {}) {
  const prisma = {
    fleet: { findMany: vi.fn().mockResolvedValue(fleets) },
    vehicle: {
      findMany: vi.fn().mockResolvedValue(existing.map((plate) => ({ plate }))),
      createMany: vi.fn().mockImplementation(({ data }) => (createError ? Promise.reject(createError) : Promise.resolve({ count: data.length }))),
    },
  };
  return { vehicles: new VehicleService(prisma as never), prisma };
}

describe('Importação de veículos por planilha', () => {
  it('planilha certa: normaliza a placa, acha a frota pelo nome e grava tudo de uma vez', async () => {
    const { vehicles, prisma } = service();
    const res = await vehicles.importVehicles({ rows: [
      { plate: 'abc-1d23', fleet: ' caminhões 1 ', prefix: 'P-01', brand: 'Volvo', model: 'FH', year: '2022' },
      { plate: 'XYZ9876', fleet: 'Máquinas 1' },
    ] });
    expect(res).toMatchObject({ created: 2, invalid: 0 });
    expect(prisma.vehicle.createMany.mock.calls[0][0].data).toEqual([
      { plate: 'ABC1D23', fleetId: 'f1', prefix: 'P-01', brand: 'Volvo', model: 'FH', year: 2022 },
      { plate: 'XYZ9876', fleetId: 'f2', prefix: null, brand: null, model: null, year: null },
    ]);
  });

  it('com qualquer linha errada não grava nada e diz o motivo de cada uma (linha da planilha)', async () => {
    const { vehicles, prisma } = service({ existing: ['BEN0001'] });
    const res = await vehicles.importVehicles({ rows: [
      { plate: 'ABC1D23', fleet: 'Caminhões 1' },
      { plate: 'BEN0001', fleet: 'Caminhões 1' },
      { plate: 'abc1d23', fleet: 'Caminhões 1' },
      { plate: 'XX12', fleet: 'Frota que não existe', year: '1890' },
      { plate: 'DEF4G56', fleet: '' },
    ] });
    expect(prisma.vehicle.createMany).not.toHaveBeenCalled();
    expect(res.created).toBe(0);
    expect(res.invalid).toBe(4);
    expect(res.results.map((r) => [r.line, r.ok, r.error])).toEqual([
      [2, true, undefined],
      [3, false, 'placa já cadastrada'],
      [4, false, 'placa repetida na linha 2'],
      [5, false, 'placa inválida (use ABC1234 ou ABC1D23); frota "Frota que não existe" não encontrada; ano inválido'],
      [6, false, 'frota em branco'],
    ]);
  });

  it('só conferir (prévia): não grava mesmo com tudo certo', async () => {
    const { vehicles, prisma } = service();
    const res = await vehicles.importVehicles({ rows: [{ plate: 'ABC1D23', fleet: 'Caminhões 1' }], dryRun: true });
    expect(res).toMatchObject({ created: 0, invalid: 0 });
    expect(prisma.vehicle.createMany).not.toHaveBeenCalled();
  });

  it('frota com o mesmo nome em duas frentes: pede para desfazer a dúvida', async () => {
    const { vehicles } = service({ fleets: [{ id: 'a', name: 'Base' }, { id: 'b', name: 'base' }] });
    const res = await vehicles.importVehicles({ rows: [{ plate: 'ABC1D23', fleet: 'Base' }] });
    expect(res.results[0].error).toBe('há mais de uma frota "Base" (renomeie uma delas)');
  });

  it('placa que já existe em outra frente (invisível para este usuário) vira aviso claro', async () => {
    const { vehicles } = service({ createError: Object.assign(new Error('unique'), { code: 'P2002' }) });
    await expect(vehicles.importVehicles({ rows: [{ plate: 'ABC1D23', fleet: 'Caminhões 1' }] })).rejects.toBeInstanceOf(ConflictException);
  });
});
