import { describe, expect, it, vi } from 'vitest';
import { ChecklistService } from './checklist.service';
import { VehicleService } from '../vehicle/vehicle.service';

describe('Lista de inspeções — itens não conformes por inspeção', () => {
  it('conta só as respostas das inspeções da página, sem `_count` (que agruparia o banco inteiro)', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    const groupBy = vi.fn().mockResolvedValue([{ checklistId: 'c1', _count: { _all: 3 } }]);
    const prisma = { checklist: { findMany, count: vi.fn().mockResolvedValue(2) }, checklistAnswer: { groupBy } };
    const page = await new ChecklistService(prisma as never, {} as never).findPage({});

    expect(findMany.mock.calls[0][0].select._count).toBeUndefined();
    expect(groupBy).toHaveBeenCalledWith({
      by: ['checklistId'],
      where: { checklistId: { in: ['c1', 'c2'] }, isCompliant: false },
      _count: { _all: true },
    });
    expect(page.items.map((c) => c.ncCount)).toEqual([3, 0]);
    expect(page.total).toBe(2);
  });

  it('página vazia não consulta as respostas', async () => {
    const groupBy = vi.fn();
    const prisma = { checklist: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) }, checklistAnswer: { groupBy } };
    const page = await new ChecklistService(prisma as never, {} as never).findPage({ page: 9 });
    expect(groupBy).not.toHaveBeenCalled();
    expect(page.items).toEqual([]);
  });
});

describe('Lista de veículos — NCs ativas por veículo', () => {
  it('mantém `_count.ncs` contando só as NCs ativas, agrupadas por veículo', async () => {
    const prisma = {
      vehicle: { findMany: vi.fn().mockResolvedValue([{ id: 'v1' }, { id: 'v2' }]) },
      nonConformity: { groupBy: vi.fn().mockResolvedValue([{ vehicleId: 'v2', _count: { _all: 4 } }]) },
    };
    const list = await new VehicleService(prisma as never).findAll();
    expect(prisma.vehicle.findMany.mock.calls[0][0].include._count).toBeUndefined();
    expect(prisma.nonConformity.groupBy.mock.calls[0][0].where).toEqual({ status: { in: ['OPEN', 'IN_PROGRESS'] } });
    expect(list.map((v) => v._count.ncs)).toEqual([0, 4]);
  });
});

describe('Detalhe da inspeção — ordem das respostas', () => {
  it('pede as respostas na ordem do modelo (seção e item), não na ordem do banco', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: 'c1', answers: [] });
    await new ChecklistService({ checklist: { findUnique } } as never, {} as never).findOne('c1');
    expect(findUnique.mock.calls[0][0].include.answers.orderBy).toEqual([
      { item: { category: { order: 'asc' } } },
      { item: { order: 'asc' } },
    ]);
  });
});
