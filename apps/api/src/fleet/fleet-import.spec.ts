import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClsServiceManager } from 'nestjs-cls';
import { FleetService } from './fleet.service';

type Opts = { units?: { id: string; name: string }[]; fleets?: { unitId: string; name: string }[] };

function service({ units = [{ id: 'u1', name: 'Contrato Porto' }, { id: 'u2', name: 'Obra Rodovia' }], fleets = [] }: Opts = {}) {
  vi.spyOn(ClsServiceManager, 'getClsService').mockReturnValue({ get: () => 't1' } as never);
  const tx = {
    unit: { create: vi.fn(({ data }) => Promise.resolve({ id: `novo-${data.name}` })) },
    fleet: { createMany: vi.fn(({ data }) => Promise.resolve({ count: data.length })) },
  };
  const prisma = {
    unit: { findMany: vi.fn().mockResolvedValue(units) },
    fleet: { findMany: vi.fn().mockResolvedValue(fleets) },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { fleetsService: new FleetService(prisma as never), prisma, tx };
}

afterEach(() => vi.restoreAllMocks());

describe('Importação de frotas por planilha', () => {
  it('acha a frente pelo nome (sem acento/caixa) e cria as frentes novas só uma vez', async () => {
    const { fleetsService, tx } = service();
    const res = await fleetsService.importFleets({ rows: [
      { fleet: 'Caminhões 1', unit: 'contrato porto' },
      { fleet: 'Ônibus', unit: 'Mina Sul', client: 'Vale' },
      { fleet: 'Vans', unit: 'mina sul' },
    ] }, true);
    expect(res).toMatchObject({ created: 3, unitsCreated: 1, newUnits: ['Mina Sul'], invalid: 0 });
    expect(tx.unit.create).toHaveBeenCalledTimes(1);
    expect(tx.unit.create.mock.calls[0][0].data).toEqual({ tenantId: 't1', name: 'Mina Sul', client: 'Vale' });
    expect(tx.fleet.createMany.mock.calls[0][0].data.map((f: { name: string; unitId: string }) => [f.name, f.unitId])).toEqual([
      ['Caminhões 1', 'u1'],
      ['Ônibus', 'novo-Mina Sul'],
      ['Vans', 'novo-Mina Sul'],
    ]);
    expect(res.results.map((r) => r.newUnit)).toEqual([false, true, true]);
  });

  it('com qualquer linha errada não grava nada e explica cada uma', async () => {
    const { fleetsService, prisma } = service({ fleets: [{ unitId: 'u1', name: 'Caminhões 1' }] });
    const res = await fleetsService.importFleets({ rows: [
      { fleet: 'CAMINHÕES 1', unit: 'Contrato Porto' },
      { fleet: 'Vans', unit: 'Obra Rodovia' },
      { fleet: 'vans', unit: 'obra rodovia' },
      { fleet: '', unit: '' },
    ] }, true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(res.results.map((r) => [r.line, r.ok, r.error])).toEqual([
      [2, false, 'já existe a frota "CAMINHÕES 1" nesta frente'],
      [3, true, undefined],
      [4, false, 'frota repetida na linha 3'],
      [5, false, 'frota em branco; frente em branco (a empresa tem mais de uma)'],
    ]);
  });

  it('gestor (não cria frentes): frente que não existe é recusada', async () => {
    const { fleetsService } = service();
    const res = await fleetsService.importFleets({ rows: [{ fleet: 'Ônibus', unit: 'Mina Sul' }] }, false);
    expect(res.results[0].error).toBe('frente "Mina Sul" não está entre as suas frentes de trabalho (só o administrador cria frentes novas)');
  });

  it('frente em branco usa a única frente da empresa; prévia não grava', async () => {
    const { fleetsService, prisma } = service({ units: [{ id: 'u1', name: 'Única' }] });
    const res = await fleetsService.importFleets({ rows: [{ fleet: 'Caminhões' }], dryRun: true }, true);
    expect(res).toMatchObject({ created: 0, invalid: 0 });
    expect(res.results[0]).toMatchObject({ ok: true, unit: 'Única' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
