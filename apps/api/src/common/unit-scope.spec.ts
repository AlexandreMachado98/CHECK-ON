import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClsServiceManager } from 'nestjs-cls';
import { UNIT_SCOPE_KEY, UnitScope, assertUnitsInScope, seesAllUnits, sqlVehicleInScope, unitScopeFilter, withUnitScope } from './unit-scope';
import { resolveUnitAssignment } from '../unit/unit-assignment';

const scope: UnitScope = { unitIds: ['a'], userId: 'u1', employeeId: 'e1' };

/** Simula o contexto da requisição com (ou sem) escopo de frentes. */
function withScope(value: UnitScope | undefined) {
  vi.spyOn(ClsServiceManager, 'getClsService').mockReturnValue({
    get: (key: string) => (key === UNIT_SCOPE_KEY ? value : undefined),
  } as never);
}

/** Prisma de mentira: as frentes "visíveis" são as do escopo (como faz a extensão). */
function unitReader(visible: string[]) {
  return {
    unit: {
      findMany: vi.fn(async ({ where }: { where: Record<string, any> }) => {
        const ids: string[] | undefined = where.id?.in;
        const list = ids ? ids.filter((id) => visible.includes(id)) : visible;
        return list.map((id) => ({ id }));
      }),
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe('frentes de trabalho: quem vê tudo', () => {
  it('administrador e super admin veem todas; os demais ficam limitados', () => {
    expect(seesAllUnits('ADMIN_EMPRESA')).toBe(true);
    expect(seesAllUnits('SUPER_ADMIN')).toBe(true);
    expect(seesAllUnits('GESTOR')).toBe(false);
    expect(seesAllUnits('SUPERVISOR')).toBe(false);
    expect(seesAllUnits('MOTORISTA')).toBe(false);
    expect(seesAllUnits(undefined)).toBe(false);
  });
});

describe('frentes de trabalho: filtro de cada modelo', () => {
  it('frota, veículo, inspeção e NC são filtrados pela frente da frota', () => {
    expect(unitScopeFilter('Fleet', scope)).toEqual({ unitId: { in: ['a'] } });
    expect(unitScopeFilter('Vehicle', scope)).toEqual({ fleet: { unitId: { in: ['a'] } } });
    expect(unitScopeFilter('Checklist', scope)).toEqual({ vehicle: { fleet: { unitId: { in: ['a'] } } } });
    expect(unitScopeFilter('NonConformity', scope)).toEqual({ vehicle: { fleet: { unitId: { in: ['a'] } } } });
  });

  it('modelo de checklist: os de todas as frentes ou os vinculados à frente', () => {
    expect(unitScopeFilter('Template', scope)).toEqual({
      OR: [{ allUnits: true }, { units: { some: { unitId: { in: ['a'] } } } }],
    });
  });

  it('o próprio funcionário e o próprio login sempre aparecem', () => {
    expect(unitScopeFilter('Employee', scope)).toEqual({
      OR: [{ id: 'e1' }, { units: { some: { unitId: { in: ['a'] } } } }],
    });
    expect((unitScopeFilter('User', scope) as { OR: unknown[] }).OR[0]).toEqual({ id: 'u1' });
  });

  it('modelos sem frente não são filtrados', () => {
    expect(unitScopeFilter('Role', scope)).toBeNull();
    expect(unitScopeFilter('Tenant', scope)).toBeNull();
  });

  it('o filtro entra no AND sem apagar as condições da consulta', () => {
    const where = withUnitScope({ id: 'x', AND: { isActive: true }, OR: [{ a: 1 }] }, { unitId: { in: ['a'] } });
    expect(where).toEqual({ id: 'x', OR: [{ a: 1 }], AND: [{ isActive: true }, { unitId: { in: ['a'] } }] });
    expect(withUnitScope(undefined, { k: 1 })).toEqual({ AND: [{ k: 1 }] });
  });
});

describe('frentes de trabalho: SQL direto do painel', () => {
  it('sem escopo (administrador): nenhuma condição', () => {
    withScope(undefined);
    expect(sqlVehicleInScope('"vehicleId"').sql).toBe('');
  });

  it('sem nenhuma frente: não conta nada', () => {
    withScope({ ...scope, unitIds: [] });
    expect(sqlVehicleInScope('"vehicleId"').sql).toBe(' AND FALSE');
  });

  it('com frentes: os ids vão como parâmetros, não no texto do SQL', () => {
    withScope({ ...scope, unitIds: ['a', 'b'] });
    const sql = sqlVehicleInScope('"vehicleId"');
    expect(sql.sql).toContain('"vehicleId" IN');
    expect(sql.values).toEqual(['a', 'b']);
  });
});

describe('frentes de trabalho: vínculos ao salvar', () => {
  it('ação numa frente fora do escopo é recusada', () => {
    withScope(scope);
    expect(() => assertUnitsInScope(['b'])).toThrow('Você não tem acesso a esta frente de trabalho.');
    expect(() => assertUnitsInScope(['a'])).not.toThrow();
  });

  it('administrador cria sem escolher: usa a única frente da empresa', async () => {
    withScope(undefined);
    expect(await resolveUnitAssignment(unitReader(['a']), undefined, null)).toEqual(['a']);
  });

  it('administrador cria sem escolher numa empresa com várias frentes: nenhuma (a tela obriga escolher)', async () => {
    withScope(undefined);
    expect(await resolveUnitAssignment(unitReader(['a', 'b']), undefined, null)).toEqual([]);
  });

  it('gestor cria sem escolher: fica com as frentes do gestor', async () => {
    withScope({ ...scope, unitIds: ['a', 'c'] });
    expect(await resolveUnitAssignment(unitReader(['a', 'c']), undefined, null)).toEqual(['a', 'c']);
  });

  it('editar sem mandar frentes não muda nada', async () => {
    withScope(scope);
    expect(await resolveUnitAssignment(unitReader(['a']), undefined, ['a', 'b'])).toBeUndefined();
  });

  it('frente que não existe ou que o gestor não vê: recusada', async () => {
    withScope(scope);
    await expect(resolveUnitAssignment(unitReader(['a']), ['b'], [])).rejects.toThrow('Frente de trabalho não encontrada.');
  });

  it('gestor edita: mantém as frentes que ele não vê', async () => {
    withScope(scope);
    expect(await resolveUnitAssignment(unitReader(['a']), ['a'], ['a', 'b'])).toEqual(['b', 'a']);
  });

  it('gestor não pode deixar o registro sem nenhuma frente dele', async () => {
    withScope(scope);
    await expect(resolveUnitAssignment(unitReader(['a']), [], ['a'])).rejects.toThrow('Escolha pelo menos uma frente de trabalho.');
  });

  it('administrador pode trocar as frentes livremente', async () => {
    withScope(undefined);
    expect(await resolveUnitAssignment(unitReader(['a', 'b']), ['b', 'b'], ['a'])).toEqual(['b']);
  });
});
