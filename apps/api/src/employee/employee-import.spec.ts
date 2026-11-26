import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClsServiceManager } from 'nestjs-cls';
import { EmployeeService, sheetDate } from './employee.service';
import * as unitScope from '../common/unit-scope';

type Options = { taken?: { matricula: string; name: string }[]; units?: { id: string; name: string }[]; scope?: string[] | null };

function service({ taken = [], units = [{ id: 'u1', name: 'Obra Norte' }, { id: 'u2', name: 'Obra Sul' }], scope = null }: Options = {}) {
  vi.spyOn(ClsServiceManager, 'getClsService').mockReturnValue({ get: () => 't1' } as never);
  vi.spyOn(unitScope, 'currentUnitIds').mockReturnValue(scope);
  const prisma = {
    unit: { findMany: vi.fn().mockResolvedValue(units) },
    $queryRaw: vi.fn().mockResolvedValue(taken),
    employee: { createMany: vi.fn((args) => ({ op: 'employees', args })) },
    employeeUnit: { createMany: vi.fn((args) => ({ op: 'links', args })) },
    $transaction: vi.fn(async (ops: { args: { data: unknown[] } }[]) => ops.map((o) => ({ count: o.args.data.length }))),
  };
  return { employees: new EmployeeService(prisma as never, {} as never), prisma };
}

afterEach(() => vi.restoreAllMocks());

/** Campos obrigatórios preenchidos, para os testes que olham outra coisa. */
const ok = { matricula: 'M-00', jobTitle: 'Motorista', admissionDate: '01/02/2020' };

describe('Importação de colaboradores por planilha', () => {
  it('planilha certa: aceita a função pelo nome da tela, data brasileira e frentes pelo nome', async () => {
    const { employees, prisma } = service();
    const res = await employees.importEmployees({ rows: [
      { name: '  Ana   Souza ', matricula: 'M-01', jobTitle: 'técnico de manutenção', department: 'Oficina', admissionDate: '05/03/2021', units: 'obra norte, Obra Sul' },
      { name: 'Bruno Lima', matricula: 'M-02', jobTitle: 'MOTORISTA', admissionDate: '2020-01-10', units: 'Obra Sul' },
    ] });
    expect(res).toMatchObject({ created: 2, invalid: 0 });
    const [rows] = prisma.employee.createMany.mock.calls[0];
    expect(rows.data[0]).toMatchObject({ tenantId: 't1', name: 'Ana Souza', matricula: 'M-01', jobTitle: 'TECNICO', departmentName: 'Oficina', admissionDate: new Date('2021-03-05T00:00:00Z') });
    expect(rows.data[1]).toMatchObject({ name: 'Bruno Lima', matricula: 'M-02', jobTitle: 'MOTORISTA', departmentName: null, admissionDate: new Date('2020-01-10T00:00:00Z') });
    expect(rows.data[0].badgeToken).toMatch(/^[0-9a-f]{64}$/);
    expect(prisma.employeeUnit.createMany.mock.calls[0][0].data).toEqual([
      { employeeId: rows.data[0].id, unitId: 'u1' },
      { employeeId: rows.data[0].id, unitId: 'u2' },
      { employeeId: rows.data[1].id, unitId: 'u2' },
    ]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('com qualquer linha errada não grava nada e diz o motivo de cada uma', async () => {
    const { employees, prisma } = service({ taken: [{ matricula: 'M-09', name: 'Carlos Dias' }] });
    const res = await employees.importEmployees({ rows: [
      { ...ok, name: 'Ana', matricula: 'm-01' },
      { ...ok, name: 'Outra Ana', matricula: 'M-01' },
      { ...ok, name: 'Davi', matricula: 'm-09' },
      { name: '', matricula: 'M-03', jobTitle: 'Gerente', admissionDate: '31/02/2020', units: 'Obra Leste' },
      { ...ok, name: 'Eva', matricula: 'M-05', admissionDate: '01/01/2999' },
      { name: 'Fábio' },
    ] });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(res.invalid).toBe(5);
    expect(res.results.map((r) => [r.line, r.ok, r.error])).toEqual([
      [2, true, undefined],
      [3, false, 'matrícula repetida na linha 2'],
      [4, false, 'matrícula já pertence a Carlos Dias'],
      [5, false, 'nome em branco; função "Gerente" não reconhecida (use Motorista, Técnico, Operador ou Supervisor); admissão inválida (use dd/mm/aaaa); frente "Obra Leste" não encontrada'],
      [6, false, 'admissão no futuro'],
      [7, false, 'matrícula em branco; função em branco; admissão em branco'],
    ]);
  });

  it('a matrícula é conferida na empresa inteira (SQL com a empresa, fora do filtro de frente)', async () => {
    const { employees, prisma } = service();
    await employees.importEmployees({ rows: [{ ...ok, name: 'Ana', matricula: ' M-01 ' }], dryRun: true });
    const [, tenant, matriculas] = prisma.$queryRaw.mock.calls[0];
    expect(tenant).toBe('t1');
    expect(matriculas.values).toEqual(['m-01']);
  });

  it('só conferir (prévia): não grava mesmo com tudo certo', async () => {
    const { employees, prisma } = service();
    const res = await employees.importEmployees({ rows: [{ ...ok, name: 'Ana' }], dryRun: true });
    expect(res).toMatchObject({ created: 0, invalid: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('frente em branco: usa a única frente da empresa; gestor limitado sem frente própria precisa informar', async () => {
    const one = service({ units: [{ id: 'u1', name: 'Única' }] });
    await one.employees.importEmployees({ rows: [{ ...ok, name: 'Ana' }] });
    expect(one.prisma.employeeUnit.createMany.mock.calls[0][0].data).toEqual([{ employeeId: expect.any(String), unitId: 'u1' }]);
    vi.restoreAllMocks();
    const scoped = service({ scope: [] });
    const res = await scoped.employees.importEmployees({ rows: [{ ...ok, name: 'Ana' }] });
    expect(res.results[0].error).toBe('informe a frente de trabalho');
  });

  it('frente com o mesmo nome duas vezes: pede para desfazer a dúvida', async () => {
    const { employees } = service({ units: [{ id: 'a', name: 'Base' }, { id: 'b', name: 'base' }] });
    const res = await employees.importEmployees({ rows: [{ ...ok, name: 'Ana', units: 'Base' }] });
    expect(res.results[0].error).toBe('há mais de uma frente "Base" (renomeie uma delas)');
  });

  it('datas: dd/mm/aaaa e aaaa-mm-dd; recusa data que não existe', () => {
    expect(sheetDate('5/3/2021')?.toISOString()).toBe('2021-03-05T00:00:00.000Z');
    expect(sheetDate('2021-03-05')?.toISOString()).toBe('2021-03-05T00:00:00.000Z');
    expect(sheetDate('29/02/2023')).toBeNull();
    expect(sheetDate('03-05-2021')).toBeNull();
  });
});
